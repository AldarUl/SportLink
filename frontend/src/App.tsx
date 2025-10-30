import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import { logout } from "@/features/auth/api";
import ProtectedRoute from "@/shared/ProtectedRoute";
import MapPage from "@/pages/map/MapPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import EventCreatePage from "@/pages/EventCreatePage";

function Nav() {
  const { user, accessToken } = useAuthStore();
  const isAuthed = Boolean(accessToken);

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <Link to="/map" className="font-semibold">SportLink</Link>
      <div className="flex items-center gap-3">
        <Link to="/map">Map</Link>

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
  return (
    <div className="h-full">
      <Nav />
      <div className="h-[calc(100%-48px)]">
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/map" element={<MapPage />} />
          </Route>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/map" replace />} />

          <Route path="/event/new" element={<EventCreatePage />} />
        
        </Routes>
      </div>
    </div>
  );
}
