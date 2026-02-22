// src/widgets/Layout.tsx
import { Outlet, Link } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import { logout } from "@/features/auth/api";
import { ToastViewport } from "@/shared/ui/toast";

export default function Layout() {
  const { user } = useAuthStore();

  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <Link to="/map" className="font-semibold">SportLink</Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/profile" className="rounded-full border px-3 py-1">
                {user.displayName?.split(" ")[0] || user.email}
              </Link>
              <button
                onClick={() => logout()}
                className="rounded bg-black px-3 py-1 text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="px-3 py-1">Login</Link>
              <Link to="/auth/register" className="rounded bg-black px-3 py-1 text-white">
                Register
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* global toasts */}
      <ToastViewport />
    </div>
  );
}
