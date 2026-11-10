import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { crearProforma } from "@/app/actions";
import { bs, cod, fecha, nombreCompleto, periodoLabel } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
export const dynamic = "force-dynamic";

export default async function Proformas({ searchParams }: { searchParams: { q?: string; socio?: string } }) {
  await requireRole(["ADMIN", "GERENTE", "CAJERO"]);
  const socio = searchParams.socio ? await q1("SELECT * FROM socios WHERE id=$1", [Number(searchParams.socio)]) : null;
  const term = (searchParams.q ?? "").trim();
  const [found, cargos, lista] = await Promise.all([
    !socio && term ? q(`SELECT id,nombres,apellidos,ci FROM socios WHERE nombres||' '||apellidos||' '||ci ILIKE $1 ORDER BY apellidos LIMIT 8`, [`%${term}%`]) : [],
    socio ? q(`SELECT c.*, m.numero FROM cargos c JOIN medidores m ON m.id=c.medidor_id WHERE c.socio_id=$1 AND c.estado='PENDIENTE' ORDER BY c.periodo, m.numero`, [socio.id]) : [],
    q(`SELECT p.*, so.nombres, so.apellidos FROM proformas p JOIN socios so ON so.id=p.socio_id ORDER BY p.id DESC LIMIT 10`),
  ]);
  return (
    <>
      <PageHeader title="Proformas" sub="Consulte y emita una proforma de las deudas de un socio" />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="card p-6 xl:col-span-3">
          {!socio ? (
            <>
              <form className="flex gap-3"><input name="q" defaultValue={term} placeholder="Buscar socio por CI o nombre…" className="input flex-1" /><button className="btn-primary">Buscar</button></form>
              <div className="mt-3 divide-y divide-ink-100">{found.map((f) => <Link key={f.id} href={`/proformas?socio=${f.id}`} className="block py-3 hover:bg-ink-50"><b>{cod(f.id)} — {nombreCompleto(f)}</b> <span className="text-xs text-ink-500">CI {f.ci}</span></Link>)}</div>
            </>
          ) : (
            <form action={crearProforma}>
              <input type="hidden" name="socio_id" value={socio.id} />
              <div className="mb-4 flex items-center justify-between"><div><div className="font-semibold">{nombreCompleto(socio)}</div><div className="text-xs text-ink-500">CI {socio.ci}</div></div><Link href="/proformas" className="btn-ghost !py-1.5">Cambiar</Link></div>
              {cargos.length === 0 ? <p className="py-8 text-center text-sm text-emerald-600">Este socio no tiene deudas.</p> : (
                <>
                  <p className="mb-2 text-xs text-ink-500">Marque los cargos a incluir (si no marca ninguno se incluye toda la deuda).</p>
                  <div className="divide-y divide-ink-100 rounded-xl ring-1 ring-ink-100">{cargos.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-ink-50"><span className="flex items-center gap-3"><input type="checkbox" name="cargo" value={c.id} />{periodoLabel(c.periodo.trim())} <span className="font-mono text-xs text-ink-500">{c.numero}</span></span><b>{bs(c.total)}</b></label>))}</div>
                  <div className="mt-4 flex items-center justify-between"><span className="text-sm text-ink-500">Deuda total: <b className="text-rose-600">{bs(cargos.reduce((a, c) => a + c.total, 0))}</b></span><button className="btn-primary">Emitir proforma</button></div>
                </>)}
            </form>)}
        </div>
        <div className="card overflow-hidden xl:col-span-2">
          <div className="p-5 pb-2 font-semibold">Emitidas recientemente</div>
          {lista.length === 0 && <Empty>Aún no hay proformas.</Empty>}
          <div className="divide-y divide-ink-100">{lista.map((p) => (
            <Link key={p.id} href={`/imprimir/proforma/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-ink-50"><div><div className="text-sm font-semibold">N° {cod(p.id, 6)} · {nombreCompleto(p)}</div><div className="text-xs text-ink-500">{fecha(p.fecha)} · válida hasta {fecha(p.vigente_hasta)}</div></div><b>{bs(p.total)}</b></Link>))}</div>
        </div>
      </div>
    </>
  );
}
