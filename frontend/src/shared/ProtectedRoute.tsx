// src/shared/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";

/**
 * Guard-роут.
 * Важно: refresh и fetchMe делаем централизованно в App.tsx.
 * Здесь мы НЕ делаем tryRefresh, иначе получаются параллельные refresh (а refresh у нас ротируемый).
 */
export default function ProtectedRoute() {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  // Авторизация считается подтверждённой только когда есть и токен, и профиль пользователя
  const isAuthed = Boolean(accessToken && user);

  return isAuthed
    ? <Outlet />
    : <Navigate to="/auth/login" replace state={{ from: location }} />;
}
