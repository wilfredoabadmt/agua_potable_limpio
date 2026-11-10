"use client";
import { useFormState, useFormStatus } from "react-dom";
import { login } from "@/app/actions";
function Btn() { const { pending } = useFormStatus(); return <button className="btn-primary w-full" disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</button>; }
export default function LoginForm() {
  const [st, action] = useFormState(login, null as { error?: string } | null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label">Correo</label><input name="email" type="email" required className="input" placeholder="usuario@comite.bo" /></div>
      <div><label className="label">Contraseña</label><input name="password" type="password" required className="input" placeholder="••••••••" /></div>
      {st?.error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{st.error}</div>}
      <Btn />
    </form>
  );
}
