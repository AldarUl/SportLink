// src/shared/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/store";
import { fetchMe, tryRefresh } from "@/features/auth/api";

export default function ProtectedRoute() {
  const location = useLocation();
  const accessToken = useAuthStore(s => s.accessToken);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const triedRefreshRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const ensureAuth = async () => {
      const tryFetchMe = async () => {
        try {
          await fetchMe();           // внутри ты кладёшь user в стор
          return true;
        } catch {
          return false;
        }
      };

      // 1) Есть access — проверяем, валиден ли
      if (accessToken) {
        const ok = await tryFetchMe();
        if (ok) { if (!cancelled) setStatus("allowed"); return; }

        // Токен мог протухнуть → пробуем silent refresh один раз
        if (!triedRefreshRef.current) {
          triedRefreshRef.current = true;
          try {
            await tryRefresh();
            const ok2 = await tryFetchMe();
            if (ok2) { if (!cancelled) setStatus("allowed"); return; }
          } catch { /* ignore */ }
        }

        if (!cancelled) setStatus("denied");
        return;
      }

      // 2) Нет access — пробуем silent refresh один раз
      if (!triedRefreshRef.current) {
        triedRefreshRef.current = true;
        try {
          await tryRefresh();
          const ok3 = await tryFetchMe();
          if (ok3) { if (!cancelled) setStatus("allowed"); return; }
        } catch { /* ignore */ }
      }

      if (!cancelled) setStatus("denied");
    };

    ensureAuth();
    return () => { cancelled = true; };
  }, [accessToken]);

  if (status === "checking") return null; // без мигания

  return status === "allowed"
    ? <Outlet />
    : <Navigate to="/auth/login" replace state={{ from: location }} />;
}
