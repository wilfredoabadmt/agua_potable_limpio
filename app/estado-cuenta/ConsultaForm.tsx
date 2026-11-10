"use client";
import { useFormState, useFormStatus } from "react-dom";
import { verificarSocio } from "@/app/actions";
function Btn() { const { pending } = useFormStatus(); return <button disabled={pending} className="btn-primary w-full">{pending ? "Consultando…" : "Ver mis deudas"}</button>; }
export default function ConsultaForm() {
  const [st, action] = useFormState(verificarSocio, null as { error?: string } | null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label">Cédula de identidad</label><input name="ci" required inputMode="numeric" className="input" placeholder="Ej. 7523718" /></div>
      <div><label className="label">Número de celular</label><input name="celular" required inputMode="tel" className="input" placeholder="Ej. 70012345" /></div>
      {st?.error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{st.error}</div>}
      <Btn />
    </form>
  );
}
