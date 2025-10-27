import { FormEvent, useState } from "react";
import { register } from "@/features/auth/api";
import { Link, useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [err,setErr] = useState<string|null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await register({ name, email, password });
      nav("/auth/login");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Registration failed");
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Create account</h1>
        {err && <div className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">{err}</div>}
        <input className="w-full rounded border px-3 py-2" placeholder="Name"
               value={name} onChange={(e)=>setName(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="Email"
               value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="Password" type="password"
               value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button className="w-full rounded bg-black px-3 py-2 text-white">Register</button>
        <div className="text-sm text-gray-600">
          Have an account? <Link className="text-blue-600" to="/auth/login">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
