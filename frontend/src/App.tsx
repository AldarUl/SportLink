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

function Nav() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isAuthed = Boolean(accessToken);

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <Link to="/map" className="font-semibold">SportLink</Link>
      <div className="flex items-center gap-3">
        <Link to="/map">Карта</Link>
        <Link to="/messages">Сообщения</Link>

        {isAuthed ? (
          <>
            <Link to="/profile" className="rounded-full border px-3 py-1">
              {user?.displayName?.split(" ")[0] || user?.email}
            </Link>
            <button onClick={() => logout()} className="rounded bg-black px-3 py-1 text-white">
              Logout
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

  if (!booted) return null;                                 // можно поставить лоадер

  return (
    <div className="h-full flex flex-col">
      <Nav />
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
          </Route>
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </div>
    </div>
  );
}
