// src/pages/RegisterPage.tsx
import { useState, type FormEvent } from "react";
import { register, login, fetchMe } from "@/features/auth/api"; // ← ДОБАВИЛИ login и fetchMe
import { Link, useNavigate } from "react-router-dom";


export default function RegisterPage() {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      await login(email.trim(), password);
      await fetchMe();
      nav("/map", { replace: true });

    } catch (e: any) {
      // бэкенд может прислать message или массив errors
        console.error("Registration flow failed:", e); // ← видно будет ReferenceError/TypeError
      const msg =
        e?.response?.data?.message ||
        (Array.isArray(e?.response?.data?.errors)
          ? e.response.data.errors.join(", ")
          : "Registration failed");
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Create account</h1>

        {err && <div className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">{err}</div>}

        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Name"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={120}
          required
        />

        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Registering…" : "Register"}
        </button>

        <div className="text-sm text-gray-600">
          Have an account? <Link className="text-blue-600" to="/auth/login">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
