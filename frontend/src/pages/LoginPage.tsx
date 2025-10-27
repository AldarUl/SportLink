import { FormEvent, useState } from "react";
import { login, fetchMe } from "@/features/auth/api";
import { useNavigate, Link } from "react-router-dom";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      await login(email, password);
      await fetchMe();
      nav("/map");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Login failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        {err && <div className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">{err}</div>}
        <input className="w-full rounded border px-3 py-2" placeholder="Email"
               value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="Password" type="password"
               value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button disabled={loading} className="w-full rounded bg-black px-3 py-2 text-white">
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <div className="text-sm text-gray-600">
          No account? <Link className="text-blue-600" to="/auth/register">Register</Link>
        </div>
      </form>
    </div>
  );
}
