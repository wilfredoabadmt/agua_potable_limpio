import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { cod, nombreCompleto, bs } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import CobroForm, { Periodo } from "@/components/CobroForm";
export const dynamic = "force-dynamic";

async function cargarPeriodos(socioId: number): Promise<Periodo[]> {
  const rows = await q(`SELECT c.id as cargoId, c.periodo, c.total, c.consumo, m.numero, t.tipo FROM cargos c JOIN medidores m ON m.id=c.medidor_id JOIN tarifarios t ON t.id=m.tarifario_id
    WHERE c.socio_id=$1 AND c.estado='PENDIENTE' ORDER BY c.periodo, m.numero`, [socioId]);
  const map = new Map<string, Periodo>();
  for (const r of rows) {
    const p = r.periodo.trim(); const e: Periodo = map.get(p) ?? { periodo: p, total: 0, items: [] };
    e.total += Number(r.total); e.items.push({ cargoId: Number(r.cargoId), medidor: r.numero, consumo: Number(r.consumo), total: Number(r.total), tipo: r.tipo }); map.set(p, e);
  }
  return [...map.values()];
}
export default async function NuevoCobro({ searchParams }: { searchParams: { q?: string; socio?: string } }) {
  await requireRole(["ADMIN", "GERENTE", "CAJERO"]);
  const cfg = await getConfig();
  const socio = searchParams.socio ? await q1("SELECT so.*, z.nombre zona FROM socios so JOIN zonas z ON z.id=so.zona_id WHERE so.id=$1", [Number(searchParams.socio)]) : null;
  const term = (searchParams.q ?? "").trim();
  const found = !socio && term ? await q(`SELECT so.id,so.nombres,so.apellidos,so.ci,so.direccion,(SELECT COALESCE(sum(total),0) FROM cargos c WHERE c.socio_id=so.id AND c.estado='PENDIENTE') deuda
      FROM socios so WHERE so.activo AND (so.nombres||' '||so.apellidos||' '||so.ci ILIKE $1) ORDER BY so.apellidos LIMIT 8`, [`%${term}%`]) : [];
  return (
    <>
      <PageHeader title="Nuevo cobro" sub="Busque al socio, seleccione los meses y procese el pago"><Link href="/recibos" className="btn-ghost">Volver</Link></PageHeader>
      {!socio ? (
        <div className="card mx-auto max-w-2xl p-6">
          <form className="flex gap-3"><input name="q" defaultValue={term} autoFocus placeholder="Buscar por CI, nombres o apellidos…" className="input flex-1" /><button className="btn-primary">Buscar</button></form>
          <div className="mt-4 divide-y divide-ink-100">
            {found.map((f) => (
              <Link key={f.id} href={`/recibos/nuevo?socio=${f.id}`} className="flex items-center justify-between py-3 hover:bg-ink-50">
                <div><div className="font-semibold">{cod(f.id)} — {nombreCompleto(f)}</div><div className="text-xs text-ink-500">CI {f.ci} · {f.direccion}</div></div>
                <span className={f.deuda > 0 ? "badge-warn" : "badge-ok"}>{f.deuda > 0 ? `Debe ${bs(f.deuda)}` : "Al día"}</span></Link>))}
            {term && found.length === 0 && <p className="py-6 text-center text-sm text-ink-500">Sin resultados para “{term}”.</p>}
          </div>
        </div>
      ) : (
        <>
          <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
            <div><div className="font-semibold">{cod(socio.id)} — {nombreCompleto(socio)}</div><div className="text-sm text-ink-500">CI {socio.ci} · {socio.direccion} · {socio.zona}</div></div>
            <Link href="/recibos/nuevo" className="btn-ghost">Cambiar socio</Link>
          </div>
          <CobroForm socioId={socio.id} periodos={await cargarPeriodos(socio.id)} qrActivo={cfg.qr_activo} />
        </>)}
    </>
  );
}
