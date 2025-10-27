import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";

export default function ProtectedRoute() {
  const accessToken = useAuthStore(s => s.accessToken);
  return accessToken ? <Outlet /> : <Navigate to="/auth/login" replace />;
}
