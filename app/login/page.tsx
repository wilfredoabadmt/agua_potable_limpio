import { getConfig } from "@/lib/config";
import { Logo } from "@/components/ui";
import LoginForm from "./LoginForm";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Login() {
  const cfg = await getConfig();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-ink-900 via-brand-900 to-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo nombre={cfg.nombre} url={cfg.logo_url} dark />
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Lectura, cobro y comprobantes en un solo lugar.</h2>
          <p className="mt-4 text-brand-100/90">Controle medidores, tarifas por consumo y pagos de sus socios, con recibos listos para imprimir y cobro por QR.</p>
        </div>
        <svg className="absolute -bottom-10 left-0 w-full opacity-30" viewBox="0 0 800 200" fill="none"><path d="M0 120c100-60 200 60 400 0s300-40 400 20v60H0z" fill="#51c9fc" /><path d="M0 150c120-50 240 40 400-10s280-20 400 30v30H0z" fill="#1d8ed3" /></svg>
        <div className="relative z-10 text-xs text-brand-200/70">© {new Date().getFullYear()} {cfg.nombre}</div>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo nombre={cfg.nombre} url={cfg.logo_url} /></div>
          <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="mb-6 mt-1 text-sm text-ink-500">Ingrese con su usuario del sistema.</p>
          <LoginForm />
          <div className="mt-6 rounded-xl bg-brand-50 p-4 text-sm text-brand-800 ring-1 ring-brand-100">
            ¿Es socio? <Link href="/estado-cuenta" className="font-semibold underline">Consulte su estado de cuenta</Link> con su CI y celular, sin iniciar sesión.
          </div>
        </div>
      </div>
    </div>
  );
}
