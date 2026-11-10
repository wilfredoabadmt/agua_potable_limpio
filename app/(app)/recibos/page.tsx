import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { anularPago } from "@/app/actions";
import { bs, cod, fechaHora, nombreCompleto } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
export const dynamic = "force-dynamic";

export default async function Recibos({ searchParams }: { searchParams: { q?: string; estado?: string } }) {
  const s = await requireRole(["ADMIN", "GERENTE", "CAJERO"]);
  const term = `%${searchParams.q ?? ""}%`;
  const pagos = await q(`SELECT p.*, so.nombres, so.apellidos, so.ci, u.nombre cajero,
      (SELECT string_agg(DISTINCT c.periodo, ', ' ORDER BY c.periodo) FROM cargos c WHERE c.pago_id=p.id) periodos
    FROM pagos p JOIN socios so ON so.id=p.socio_id LEFT JOIN usuarios u ON u.id=p.cajero_id
    WHERE (so.nombres||' '||so.apellidos||' '||so.ci ILIKE $1 OR lpad(p.id::text,6,'0') LIKE $1)
      AND ($2='' OR ($2='ANULADO' AND p.anulado) OR ($2='VIGENTE' AND NOT p.anulado))
      AND ($3 <> 'CAJERO' OR p.cajero_id = $4 OR p.fecha::date < current_date - 30)
    ORDER BY p.id DESC LIMIT 50`, [term, searchParams.estado ?? "", s.rol, s.uid]);
  const deudas = await q(`SELECT so.id, so.nombres, so.apellidos, so.ci, count(DISTINCT c.periodo) meses, sum(c.total) total FROM cargos c JOIN socios so ON so.id=c.socio_id WHERE c.estado='PENDIENTE' GROUP BY so.id ORDER BY total DESC LIMIT 5`);
  return (
    <>
      <PageHeader title="Recibos y cobros" sub="Historial de pagos y cuentas pendientes"><Link href="/recibos/nuevo" className="btn-primary">+ Nuevo cobro</Link></PageHeader>
      <form className="card mb-4 flex flex-wrap gap-3 p-4">
        <input name="q" defaultValue={searchParams.q} placeholder="Buscar por socio, CI o N° de recibo…" className="input min-w-[240px] flex-1" />
        <select name="estado" defaultValue={searchParams.estado ?? ""} className="input w-44"><option value="">Todos</option><option value="VIGENTE">Vigentes</option><option value="ANULADO">Anulados</option></select>
        <button className="btn-primary">Buscar</button>
      </form>
      <div className="grid gap-6 xl:grid-cols-4">
        <div className="card overflow-x-auto xl:col-span-3">
          <table className="w-full min-w-[820px]">
            <thead><tr><th className="th">Recibo</th><th className="th">Socio</th><th className="th">Periodos</th><th className="th">Método</th><th className="th">Fecha</th><th className="th text-right">Total</th><th className="th text-right">Acciones</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {pagos.length === 0 && <tr><td colSpan={7}><Empty>Sin resultados.</Empty></td></tr>}
              {pagos.map((p) => (
                <tr key={p.id} className={p.anulado ? "opacity-60" : ""}>
                  <td className="td font-mono text-xs">N° {cod(p.id, 6)}{p.anulado && <span className="badge-bad ml-2">Anulado</span>}</td>
                  <td className="td"><div className="font-semibold">{nombreCompleto(p)}</div><div className="text-xs text-ink-500">CI {p.ci}</div></td>
                  <td className="td text-xs text-ink-500">{p.periodos}</td>
                  <td className="td"><span className={p.metodo === "QR" ? "badge-info" : "badge-ok"}>{p.metodo}</span></td>
                  <td className="td text-ink-500">{fechaHora(p.fecha)}</td>
                  <td className="td text-right font-semibold">{bs(p.total)}</td>
                  <td className="td text-right">
                    <Link href={`/imprimir/recibo/${p.id}`} className="text-sm font-semibold text-brand-700">Imprimir</Link>
                    {!p.anulado && s.rol !== "CAJERO" && (
                      <details className="relative ml-3 inline-block text-left"><summary className="cursor-pointer list-none text-sm font-semibold text-rose-600">Anular</summary>
                        <form action={anularPago} className="absolute right-0 z-10 mt-1 w-64 space-y-2 rounded-xl bg-white p-3 shadow-card ring-1 ring-ink-100">
                          <input type="hidden" name="id" value={p.id} /><input name="motivo" required placeholder="Motivo de anulación" className="input" /><button className="btn-danger w-full !py-2">Confirmar anulación</button></form></details>)}
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Mayores deudas</h2>
          <div className="space-y-3">{deudas.map((d) => (
            <Link key={d.id} href={`/recibos/nuevo?socio=${d.id}`} className="block rounded-xl p-3 ring-1 ring-ink-100 hover:bg-ink-50">
              <div className="text-sm font-semibold">{nombreCompleto(d)}</div><div className="flex justify-between text-xs text-ink-500"><span>{d.meses} meses</span><b className="text-rose-600">{bs(d.total)}</b></div></Link>))}</div>
        </div>
      </div>
    </>
  );
}
