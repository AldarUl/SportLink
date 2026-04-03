import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";

/**
 * Guard для админских страниц.
 * Предполагается, что наружный ProtectedRoute уже проверил авторизацию.
 */
export default function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  return isAdmin ? <Outlet /> : <Navigate to="/map" replace />;
}
