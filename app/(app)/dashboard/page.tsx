import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { bs, periodoActual, periodoLabel, fechaHora, nombreCompleto, cod } from "@/lib/format";
import { PageHeader, Stat, Empty } from "@/components/ui";
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const s = await requireRole(["ADMIN", "GERENTE", "LECTOR", "CAJERO"]);
  const per = periodoActual();
  const [k, meses, zonas, ultimos] = await Promise.all([
    q1(`SELECT
      (SELECT count(*) FROM socios WHERE activo) socios,
      (SELECT count(*) FROM medidores WHERE estado='ACTIVO') medidores,
      (SELECT COALESCE(sum(total),0) FROM pagos WHERE NOT anulado AND date_trunc('month',fecha)=date_trunc('month',now())) recaudado,
      (SELECT COALESCE(sum(total),0) FROM cargos WHERE estado='PENDIENTE') deuda,
      (SELECT count(*) FROM medidores m JOIN tarifarios t ON t.id=m.tarifario_id WHERE m.estado='ACTIVO' AND t.tipo='CONSUMO'
         AND NOT EXISTS (SELECT 1 FROM lecturas l WHERE l.medidor_id=m.id AND l.periodo=$1)) faltan,
      (SELECT count(DISTINCT socio_id) FROM cargos WHERE estado='PENDIENTE') deudores`, [per]),
    q(`SELECT to_char(date_trunc('month',fecha),'YYYY-MM') p, sum(total) t FROM pagos WHERE NOT anulado AND fecha >= date_trunc('month',now()) - interval '5 months' GROUP BY 1 ORDER BY 1`),
    q(`SELECT z.nombre, COALESCE(sum(c.total),0) deuda FROM zonas z LEFT JOIN socios so ON so.zona_id=z.id LEFT JOIN cargos c ON c.socio_id=so.id AND c.estado='PENDIENTE' GROUP BY z.nombre ORDER BY 2 DESC`),
    q(`SELECT p.id,p.total,p.metodo,p.fecha,so.nombres,so.apellidos FROM pagos p JOIN socios so ON so.id=p.socio_id WHERE NOT p.anulado ORDER BY p.fecha DESC LIMIT 6`),
  ]);
  const max = Math.max(1, ...meses.map((m) => m.t));
  const maxZ = Math.max(1, ...zonas.map((z) => z.deuda));
  const staff = s.rol !== "LECTOR";
  return (
    <>
      <PageHeader title={`Hola, ${s.nombre.split(" ")[0]}`} sub={`Resumen del servicio · ${periodoLabel(per)}`}>
        {s.rol !== "CAJERO" && <Link href="/lecturas" className="btn-ghost">Registrar lecturas</Link>}
        {s.rol !== "LECTOR" && <Link href="/recibos/nuevo" className="btn-primary">+ Nuevo cobro</Link>}
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {staff && <Stat label="Recaudado este mes" value={bs(k!.recaudado)} tone="emerald" />}
        {staff && <Stat label="Deuda pendiente" value={bs(k!.deuda)} hint={`${k!.deudores} socios con deuda`} tone="rose" />}
        <Stat label="Lecturas faltantes" value={k!.faltan} hint={`Periodo ${periodoLabel(per)}`} tone="amber" />
        <Stat label="Socios · Medidores" value={`${k!.socios} · ${k!.medidores}`} hint="Activos" />
      </div>
      {staff && (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="card p-6 xl:col-span-2">
            <h2 className="font-semibold">Recaudación de los últimos 6 meses</h2>
            {meses.length === 0 ? <Empty>Aún no hay pagos registrados.</Empty> : (
              <div className="mt-6 flex h-56 items-stretch gap-4">
                {meses.map((m) => (
                  <div key={m.p} className="flex flex-1 flex-col items-center gap-2">
                    <div className="text-xs font-semibold text-ink-700">{bs(m.t).replace("Bs ", "")}</div>
                    <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t-xl bg-gradient-to-t from-brand-600 to-brand-300" style={{ height: `${Math.max(6, (m.t / max) * 100)}%` }} /></div>
                    <div className="text-xs text-ink-500">{periodoLabel(m.p).slice(0, 3)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-6">
            <h2 className="font-semibold">Deuda por zona</h2>
            <div className="mt-5 space-y-4">
              {zonas.map((z) => (
                <div key={z.nombre}>
                  <div className="mb-1 flex justify-between text-sm"><span>{z.nombre}</span><span className="font-semibold">{bs(z.deuda)}</span></div>
                  <div className="h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-rose-400" style={{ width: `${(z.deuda / maxZ) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="card overflow-hidden xl:col-span-3">
            <div className="flex items-center justify-between p-6 pb-3"><h2 className="font-semibold">Últimos pagos</h2><Link href="/recibos" className="text-sm font-semibold text-brand-700">Ver todos</Link></div>
            <table className="w-full"><thead><tr><th className="th">Recibo</th><th className="th">Socio</th><th className="th">Método</th><th className="th">Fecha</th><th className="th text-right">Monto</th></tr></thead>
              <tbody className="divide-y divide-ink-100">{ultimos.map((p) => (
                <tr key={p.id}><td className="td font-mono text-xs">N° {cod(p.id, 6)}</td><td className="td">{nombreCompleto(p)}</td>
                  <td className="td"><span className={p.metodo === "QR" ? "badge-info" : "badge-ok"}>{p.metodo}</span></td><td className="td text-ink-500">{fechaHora(p.fecha)}</td><td className="td text-right font-semibold">{bs(p.total)}</td></tr>))}
              </tbody></table>
          </div>
        </div>
      )}
    </>
  );
}
