"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Gauge, Receipt, FileText, Tags, MapPin, BarChart3, ShieldCheck, Settings, QrCode, Wallet } from "lucide-react";

const ALL = ["ADMIN", "GERENTE", "LECTOR", "CAJERO"];
const NAV = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, roles: ALL },
  { href: "/socios", label: "Socios", icon: Users, roles: ["ADMIN", "GERENTE", "CAJERO"] },
  { href: "/lecturas", label: "Lecturas", icon: Gauge, roles: ["ADMIN", "GERENTE", "LECTOR"] },
  { href: "/recibos", label: "Recibos y cobros", icon: Receipt, roles: ["ADMIN", "GERENTE", "CAJERO"] },
  { href: "/proformas", label: "Proformas", icon: FileText, roles: ["ADMIN", "GERENTE", "CAJERO"] },
  { href: "/tarifas", label: "Catálogos y tarifas", icon: Tags, roles: ["ADMIN", "GERENTE"] },
  { href: "/zonas", label: "Zonas", icon: MapPin, roles: ["ADMIN", "GERENTE"] },
  { href: "/reportes", label: "Reportes", icon: BarChart3, roles: ["ADMIN", "GERENTE"] },
  { href: "/admin/usuarios", label: "Usuarios y roles", icon: ShieldCheck, roles: ["ADMIN"] },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, roles: ["ADMIN"] },
  { href: "/admin/api", label: "Pasarela QR (API)", icon: QrCode, roles: ["ADMIN"] },
  { href: "/mi-cuenta", label: "Mi estado de cuenta", icon: Wallet, roles: ["SOCIO"] },
];
export default function Sidebar({ rol }: { rol: string }) {
  const path = usePathname();
  return (
    <nav className="mt-6 space-y-1">
      {NAV.filter((n) => n.roles.includes(rol)).map(({ href, label, icon: Icon }) => {
        const on = path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-white/10 text-white ring-1 ring-white/10" : "text-ink-300 hover:bg-white/5 hover:text-white"}`}>
            <Icon className={`h-[18px] w-[18px] ${on ? "text-brand-300" : ""}`} />{label}
          </Link>
        );
      })}
    </nav>
  );
}
