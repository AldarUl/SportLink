// src/api/http.ts
import axios from "axios";
import type { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/features/auth/store";

const API_URL = (import.meta.env.VITE_API_URL as string) ?? "/api/v1";

/* ------- helpers читать/писать access из Zustand/LS ------- */
function getAccessToken(): string | null {
  const s = useAuthStore.getState();
  if (s?.accessToken) return s.accessToken;
  try {
    const raw = localStorage.getItem("sportlink_tokens");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.accessToken ?? null;
  } catch {
    return null;
  }
}
function setAccessToken(token: string | null) {
  // не затираем refreshToken, если он вдруг используется (часто refresh хранится в HttpOnly cookie)
  const s: any = useAuthStore.getState();
  useAuthStore.getState().setTokens({
    accessToken: token,
    refreshToken: s?.refreshToken ?? null,
  });
}

/* ------- axios instance ------- */
export const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // чтобы refresh-cookie ходила на /auth/refresh
});

/* ------- single-flight refresh + safe redirect ------- */
let refreshPromise: Promise<string> | null = null;
let redirecting = false;

function logoutAndRedirect() {
  if (redirecting) return;
  redirecting = true;
  try {
    useAuthStore.getState().logout();
  } catch {
    /* no-op */
  }
  // Не делаем полный reload, если мы и так на страницах /auth/* — иначе выглядит как "мигает/обновляется".
  if (typeof window !== "undefined") {
    const p = window.location.pathname || "";
    if (!p.startsWith("/auth")) {
      // replace — чтобы нельзя было нажать Back и вернуться в «битую» сессию
      window.location.replace("/auth/login");
    }
  }
}

async function refreshAccessToken(): Promise<string> {
  // ВАЖНО: refresh делаем через "чистый" axios, чтобы request-интерсептор не добавлял протухший Bearer
  const rt = (useAuthStore.getState() as any)?.refreshToken;
  const body = rt ? { refreshToken: rt } : {};
  const { data } = await axios.post(`${API_URL}/auth/refresh`, body, { withCredentials: true });
  const newToken: string | undefined = data?.accessToken ?? data?.token;
  if (!newToken) throw new Error("No access token in refresh response");
  setAccessToken(newToken);
  return newToken;
}

async function getFreshToken(): Promise<string> {
  const p = refreshPromise ?? (refreshPromise = refreshAccessToken());
  try {
    return await p;
  } finally {
    // очищаем только если это тот же promise
    if (refreshPromise === p) refreshPromise = null;
  }
}

/* ------- request: подставляем Bearer ------- */
http.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    // Axios v1 типизирует headers как AxiosHeaders, поэтому безопаснее мутировать
    cfg.headers = (cfg.headers ?? {}) as any;
    (cfg.headers as any).Authorization = `Bearer ${token}`;
  }
  return cfg;
});

/* ------- response (SUCCESS): авто-удаление события из стора после DELETE ------- */
http.interceptors.response.use(
  async (response) => {
    try {
      const method = (response.config.method || "").toLowerCase();
      let url = response.config.url || "";

      // нормализуем url (убираем baseURL и query)
      if (url.startsWith(API_URL)) url = url.slice(API_URL.length);
      // матчим .../event/{uuid}[?...]
      const m = url.match(/\/event\/([0-9a-fA-F-]{36})(?:\/)?(?:\?.*)?$/);

      if (method === "delete" && m && (response.status === 200 || response.status === 204)) {
        const id = m[1];
        // ленивый импорт, чтобы не словить циклический импорт
        const mod = await import("@/entities/event/store");
        const st = mod.useEventStore.getState();
        if (st.events.some((x) => x.id === id)) {
          st.remove(id); // синхронно выкинем из стора → карта перерисуется
        }
      }
    } catch {
      /* no-op */
    }
    return response;
  },

  /* ------- response (ERROR): авто-refresh по 401 с очередью ------- */
  async (error: AxiosError) => {
    const res = error.response;
    const original: any = error.config as AxiosRequestConfig & { _retry?: boolean };

    const status = res?.status;

    const isAuthCall =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/refresh") ||
      original?.url?.includes("/auth/me");

    const isAdminCall = original?.url?.includes("/admin/");

    const shouldTryRefresh =
      status === 401 && !isAuthCall && !original?._retry;
    if (shouldTryRefresh) {
      original._retry = true;
      try {
        const newToken = await getFreshToken();
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
        return http(original);
      } catch {
        // refresh не удался → выходим и редиректим, не отдавая ошибку в компоненты
        logoutAndRedirect();
        return new Promise(() => {});
      }
    }

    if (status === 401 && !isAuthCall && original?._retry) {
      logoutAndRedirect();
      return new Promise(() => {});
    }

    // 401 без retry считаем разлогином ТОЛЬКО если у нас была сессия (есть access token).
    // Иначе это может быть просто 401 на приватный эндпоинт при открытии сайта "с нуля".
    if (status === 401) {
      if (getAccessToken()) {
        logoutAndRedirect();
        return new Promise(() => {});
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);
