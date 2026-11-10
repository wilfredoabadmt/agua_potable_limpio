import { requireRole } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { logout } from "@/app/actions";
import Sidebar from "@/components/Sidebar";
import { Logo } from "@/components/ui";
import { LogOut } from "lucide-react";

const ROL: Record<string, string> = { ADMIN: "Administrador", GERENTE: "Gerente", LECTOR: "Lector", CAJERO: "Cajero", SOCIO: "Socio" };
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole();
  const cfg = await getConfig();
  return (
    <div className="flex min-h-screen">
      <div className="no-print hidden w-64 shrink-0 bg-ink-900 lg:block"><aside className="sticky top-0 flex h-screen flex-col justify-between overflow-y-auto p-5">
        <div><Logo nombre={cfg.nombre} url={cfg.logo_url} dark /><Sidebar rol={s.rol} /></div>
        <form action={logout}>
          <div className="mb-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="text-sm font-semibold text-white">{s.nombre}</div>
            <div className="text-xs text-brand-300">{ROL[s.rol]}</div>
          </div>
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-300 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" />Cerrar sesión</button>
        </form>
      </aside></div>
      <main className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}
