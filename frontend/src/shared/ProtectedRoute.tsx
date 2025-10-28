// src/shared/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/features/auth/store";
import { fetchMe, tryRefresh } from "@/features/auth/api";

export default function ProtectedRoute() {
  const loc = useLocation();
  const { accessToken, user } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [triedRefresh, setTriedRefresh] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (accessToken) {
          if (!user) await fetchMe();
          return;
        }
        // нет access — пробуем silent refresh один раз
        if (!triedRefresh) {
          setTriedRefresh(true);
          try {
            await tryRefresh();   // получим новый access по cookie
            await fetchMe();
          } catch {
            /* ignore — уйдём на /auth/login ниже */
          }
        }
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => { alive = false; };
  }, [accessToken, user, triedRefresh]);

  if (checking) return <div className="p-6">Checking session…</div>;
  const authed = useAuthStore.getState().accessToken != null;
  return authed ? <Outlet /> : <Navigate to="/auth/login" state={{ from: loc }} replace />;
}
