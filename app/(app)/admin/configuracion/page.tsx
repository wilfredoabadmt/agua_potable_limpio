import { requireRole } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { q } from "@/lib/db";
import { guardarConfig } from "@/app/actions";
import { fechaHora } from "@/lib/format";
import { PageHeader, Logo } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Configuracion() {
  await requireRole(["ADMIN"]);
  const [cfg, aud] = await Promise.all([getConfig(), q("SELECT * FROM auditoria ORDER BY id DESC LIMIT 12")]);
  return (
    <>
      <PageHeader title="Configuración" sub="Parámetros generales, identidad del comité y auditoría" />
      <div className="grid gap-6 xl:grid-cols-2">
        <form action={guardarConfig} className="card space-y-4 p-6">
          <h2 className="font-semibold">Identidad y parámetros</h2>
          <div className="rounded-xl bg-ink-900 p-4"><Logo nombre={cfg.nombre} url={cfg.logo_url} dark /></div>
          <div><label className="label">Nombre del comité / sistema</label><input name="nombre" defaultValue={cfg.nombre} required className="input" /></div>
          <div><label className="label">Logo (PNG/JPG, máx. 300 KB)</label><input name="logo" type="file" accept="image/*" className="input" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Moneda</label><input name="moneda" defaultValue={cfg.moneda} className="input" /></div>
            <div><label className="label">Día de vencimiento</label><input name="vencimiento_dia" type="number" min={1} max={28} defaultValue={cfg.vencimiento_dia} className="input" /></div></div>
          <button className="btn-primary w-full">Guardar configuración</button>
        </form>
        <div className="card p-6"><h2 className="mb-3 font-semibold">Auditoría reciente</h2>
          <div className="divide-y divide-ink-100">{aud.map((a) => <div key={a.id} className="py-2.5 text-sm"><div className="flex justify-between"><b>{a.accion}</b><span className="text-xs text-ink-500">{fechaHora(a.fecha)}</span></div><div className="text-xs text-ink-500">{a.usuario} · {a.detalle}</div></div>)}</div></div>
      </div>
    </>
  );
}
