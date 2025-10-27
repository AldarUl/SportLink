import axios from "axios";
import { useAuthStore } from "@/features/auth/store";



export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // http://localhost:8080/api/v1
});

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});


// упрощённый авто-рефреш
let refreshing = false;
let waiters: Array<() => void> = [];

http.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (refreshing) {
        await new Promise<void>((res) => waiters.push(res));
      } else {
        refreshing = true;
        try {
          const { refreshToken, setTokens, logout } = useAuthStore.getState();
          if (!refreshToken) throw new Error("no refresh");

          const { data } = await axios.post(
            `${import.meta.env.VITE_API_URL}/auth/refresh`,
            { refreshToken },
            { withCredentials: false }
          );
          setTokens({ accessToken: data.accessToken, refreshToken });
        } catch {
          useAuthStore.getState().logout();
          return Promise.reject(error);
        } finally {
          refreshing = false;
          waiters.forEach((fn) => fn());
          waiters = [];
        }
      }
      return http(original);
    }
    return Promise.reject(error);
  }
);
