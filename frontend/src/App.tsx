// src/App.tsx
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";                // ⬅️ добавили useState
import { useAuthStore } from "@/features/auth/store";
import { fetchMe, tryRefresh, logout } from "@/features/auth/api"; // сгруппировал импорты
import { useApplicationStore } from "@/entities/application/store";
import ProtectedRoute from "@/shared/ProtectedRoute";
import MapPage from "@/pages/map/MapPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import EventCreatePage from "@/pages/EventCreatePage";
import EventDetailPage from "@/pages/event/EventDetailPage";
import EventEditPage from "@/pages/event/EventEditPage";
import SkillsGate from "@/features/skills/SkillsGate";
import ProfilePage from "@/pages/profile/ProfilePage";


function getJwtExpMs(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    // base64url -> base64
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(json);
    return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function shouldRefreshSoon(token: string | null | undefined, withinMs = 90_000) {
  const exp = getJwtExpMs(token);
  if (!exp) return false;
  return exp - Date.now() < withinMs;
}


function Nav() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthed = Boolean(accessToken);

  return (
    <div className="grid grid-cols-3 items-center border-b px-4 py-2">
      {/* left spacer */}
      <div />

      {/* centered logo */}
      <Link
        to="/map"
        className="sportlink-wordmark justify-self-center text-2xl font-extrabold tracking-wide"
        aria-label="SportLink"
      >
        SportLink
      </Link>

      {/* right actions */}
      <div className="justify-self-end flex items-center gap-2">
        {isAuthed ? (
          <>
            <Link to="/profile" className="rounded-full border px-3 py-1">
              Мой профиль
            </Link>
            <button onClick={() => logout()} className="rounded bg-black px-3 py-1 text-white">
              Выйти
            </button>
          </>
        ) : (
          <>
            <Link to="/auth/login">Login</Link>
            <Link to="/auth/register" className="rounded bg-black px-3 py-1 text-white">
              Register
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [booted, setBooted] = useState(false);             // ⬅️ завели состояние

  // 1) Тихий рефреш при старте и загрузка профиля
  useEffect(() => {
    (async () => {
      if (!useAuthStore.getState().accessToken) {
        try { await tryRefresh(); } catch {}
      }
      if (useAuthStore.getState().accessToken && !useAuthStore.getState().user) {
        try { await fetchMe(); } catch {}
      }
      setBooted(true);                                      // ⬅️ отмечаем готовность
    })();
  }, []);

  // 2) При появлении токена — подтянуть мои заявки
  useEffect(() => {
    if (accessToken) {
      useApplicationStore.getState().loadMine().catch(() => {});
    }
  }, [accessToken]);

  // 3) Авто-обновление accessToken до истечения (чтобы после простоя не ловить 403 в панелях)
  useEffect(() => {
    if (!accessToken) return;

    const expMs = getJwtExpMs(accessToken);
    if (!expMs) return;

    // обновляем за 60 секунд до exp
    const refreshAt = expMs - 60_000;
    const delay = Math.max(1_000, refreshAt - Date.now());

    const t = window.setTimeout(() => {
      tryRefresh().catch(() => {
        // если refresh-cookie тоже протухла — редиректим
        try { useAuthStore.getState().logout(); } catch {}
        window.location.replace("/auth/login");
      });
    }, delay);

    return () => window.clearTimeout(t);
  }, [accessToken]);

  // 4) Если вкладка была в фоне и вернулись — освежаем токен, если скоро истечёт
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const tok = useAuthStore.getState().accessToken;
      if (tok && shouldRefreshSoon(tok, 2 * 60_000)) {
        tryRefresh().catch(() => {
          try { useAuthStore.getState().logout(); } catch {}
          window.location.replace("/auth/login");
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!booted) return null;                                 // можно поставить лоадер

  return (
    <div className="h-full flex flex-col">
      <Nav />
      <SkillsGate />
      <div className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          {/* Публичные */}
          <Route path="/event/:id" element={<EventDetailPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          {/* Защищённые */}
          <Route element={<ProtectedRoute />}>
            <Route path="/map" element={<MapPage />} />
            <Route path="/event/new" element={<EventCreatePage />} />
            <Route path="/event/:id/edit" element={<EventEditPage />} />
            <Route path="/profile" element={<ProfilePage />} />          {/* мой профиль */}
          </Route>
          <Route path="/profile/:id" element={<ProfilePage />} />        {/* публичный профиль */}
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </div>
    </div>
  );
}
