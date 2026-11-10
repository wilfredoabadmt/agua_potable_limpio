import Link from "next/link";
import { redirect } from "next/navigation";
import { verify } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { bs, cod, fechaHora, nombreCompleto } from "@/lib/format";
import { Logo } from "@/components/ui";
import CobroForm, { Periodo } from "@/components/CobroForm";
export const dynamic = "force-dynamic";

export default async function Ver({ searchParams }: { searchParams: { t?: string } }) {
  const tok = await verify<{ socioId: number }>(searchParams.t);
  if (!tok) redirect("/estado-cuenta");
  const [cfg, socio, medidores, rows, pagos] = await Promise.all([
    getConfig(), q1("SELECT so.*, z.nombre zona FROM socios so JOIN zonas z ON z.id=so.zona_id WHERE so.id=$1", [tok.socioId]),
    q(`SELECT m.numero, m.ubicacion, t.nombre tarifa FROM medidores m JOIN tarifarios t ON t.id=m.tarifario_id WHERE m.socio_id=$1 AND m.estado<>'BAJA' ORDER BY m.id`, [tok.socioId]),
    q(`SELECT c.id as cargoId, c.periodo, c.total, c.consumo, m.numero, t.tipo FROM cargos c JOIN medidores m ON m.id=c.medidor_id JOIN tarifarios t ON t.id=m.tarifario_id WHERE c.socio_id=$1 AND c.estado='PENDIENTE' ORDER BY c.periodo, m.numero`, [tok.socioId]),
    q(`SELECT id, fecha, total, metodo, anulado FROM pagos WHERE socio_id=$1 ORDER BY id DESC LIMIT 10`, [tok.socioId]),
  ]);
  const map = new Map<string, Periodo>();
  for (const r of rows) { const p = r.periodo.trim(); const e: Periodo = map.get(p) ?? { periodo: p, total: 0, items: [] }; e.total += Number(r.total); e.items.push({ cargoId: Number(r.cargoId), medidor: r.numero, consumo: Number(r.consumo), total: Number(r.total), tipo: r.tipo }); map.set(p, e); }
  const periodos = [...map.values()], deuda = periodos.reduce((a, p) => a + p.total, 0);
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white px-6 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between"><Logo nombre={cfg.nombre} url={cfg.logo_url} /><Link href="/estado-cuenta" className="btn-ghost !py-1.5">Salir</Link></div></header>
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div><div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Estado de cuenta</div><h1 className="text-2xl font-bold">{nombreCompleto(socio)}</h1><p className="text-sm text-ink-500">Código {cod(socio.id)} · CI {socio.ci} · {socio.direccion} · {socio.zona}</p>
            <div className="mt-2 flex flex-wrap gap-2">{medidores.map((m) => <span key={m.numero} className="badge-info">{m.numero} · {m.tarifa}</span>)}</div></div>
          <div className="rounded-2xl bg-ink-900 px-6 py-4 text-right text-white"><div className="text-xs uppercase tracking-wider text-brand-300">Deuda total</div><div className="text-3xl font-bold">{bs(deuda)}</div></div>
        </div>
        <h2 className="text-lg font-semibold">Sus deudas {cfg.qr_activo && <span className="text-sm font-normal text-ink-500">· ¿Desea cancelar? Seleccione los meses y pague con QR</span>}</h2>
        <CobroForm socioId={socio.id} periodos={periodos} qrActivo={cfg.qr_activo} token={searchParams.t} />
        <div className="card overflow-hidden"><div className="p-6 pb-2 font-semibold">Historial de pagos</div>
          <table className="w-full"><tbody className="divide-y divide-ink-100">{pagos.map((p) => (
            <tr key={p.id}><td className="td font-mono text-xs">N° {cod(p.id, 6)}</td><td className="td text-ink-500">{fechaHora(p.fecha)}</td><td className="td"><span className="badge-info">{p.metodo}</span>{p.anulado && <span className="badge-bad ml-2">Anulado</span>}</td>
              <td className="td text-right font-semibold">{bs(p.total)}</td><td className="td text-right"><Link className="text-sm font-semibold text-brand-700" href={`/imprimir/recibo/${p.id}?t=${searchParams.t}`}>Comprobante</Link></td></tr>))}
            {pagos.length === 0 && <tr><td className="td text-ink-500">Aún no registra pagos.</td></tr>}</tbody></table></div>
      </main>
    </div>
  );
}
