import { getConfig } from "@/lib/config";
import { Logo } from "@/components/ui";
import ConsultaForm from "./ConsultaForm";
export const dynamic = "force-dynamic";
export default async function EstadoCuenta() {
  const cfg = await getConfig();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 p-6">
      <div className="card w-full max-w-md p-8">
        <Logo nombre={cfg.nombre} url={cfg.logo_url} />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Consulte su estado de cuenta</h1>
        <p className="mb-6 mt-1 text-sm text-ink-500">Ingrese su CI y el número de celular registrado en el comité.</p>
        <ConsultaForm />
      </div>
    </div>
  );
}
