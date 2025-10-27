import { Routes, Route, Navigate, Link } from "react-router-dom";
import ProtectedRoute from "@/shared/ProtectedRoute";
import MapPage from "@/pages/MapPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

function Nav() {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <Link to="/map" className="font-semibold">SportLink</Link>
      <div className="space-x-3">
        <Link to="/map">Map</Link>
        <Link to="/auth/login">Login</Link>
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
            {/* добавим позже: /feed, /events/:id, /profile */}
          </Route>

          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </div>
    </div>
  );
}
