import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { bs, cod, fecha, nombreCompleto, periodoLabel } from "@/lib/format";
import PrintButton from "@/components/PrintButton";
export const dynamic = "force-dynamic";

export default async function Proforma({ params }: { params: { id: string } }) {
  const ses = await getSession(); if (!ses || ses.rol === "SOCIO") redirect("/login");
  const p = await q1(`SELECT p.*, so.nombres, so.apellidos, so.ci, so.direccion, z.nombre zona FROM proformas p JOIN socios so ON so.id=p.socio_id JOIN zonas z ON z.id=so.zona_id WHERE p.id=$1`, [Number(params.id)]);
  if (!p) notFound();
  const [cfg, det] = await Promise.all([getConfig(), q(`SELECT c.*, m.numero FROM cargos c JOIN medidores m ON m.id=c.medidor_id WHERE c.id = ANY($1) ORDER BY c.periodo, m.numero`, [p.cargo_ids])]);
  return (
    <div className="min-h-screen bg-ink-100 p-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end"><PrintButton label="Imprimir proforma" /></div>
      <div className="print-sheet mx-auto max-w-3xl bg-white p-10 shadow-card ring-1 ring-ink-100">
        <div className="flex items-start justify-between border-b border-ink-100 pb-5">
          <div><div className="text-lg font-bold">{cfg.nombre}</div><div className="text-xs text-ink-500">Proforma de deuda · Servicio de agua potable</div></div>
          <div className="text-right"><div className="text-xs uppercase tracking-wider text-ink-500">Proforma N°</div><div className="font-mono text-xl font-bold">{cod(p.id, 6)}</div></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-ink-500">Socio: </span><b>{nombreCompleto(p)}</b></div><div><span className="text-ink-500">CI: </span>{p.ci}</div>
          <div><span className="text-ink-500">Dirección: </span>{p.direccion} ({p.zona})</div><div><span className="text-ink-500">Emitida: </span>{fecha(p.fecha)} · <span className="text-ink-500">Válida hasta: </span><b>{fecha(p.vigente_hasta)}</b></div>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead><tr className="border-b border-ink-300 text-left text-[11px] uppercase tracking-wider text-ink-500"><th className="py-2">Periodo</th><th>Medidor</th><th className="text-right">Consumo</th><th className="text-right">Importe</th></tr></thead>
          <tbody>{det.map((d) => <tr key={d.id} className="border-b border-ink-100"><td className="py-2">{periodoLabel(d.periodo)}</td><td className="font-mono text-xs">{d.numero}</td><td className="text-right">{d.consumo ? `${d.consumo} m³` : "Fijo"}</td><td className="text-right font-semibold">{bs(d.total)}</td></tr>)}</tbody>
        </table>
        <div className="mt-6 flex justify-end"><div className="rounded-2xl bg-brand-50 px-6 py-4 text-right ring-1 ring-brand-100"><div className="text-xs uppercase tracking-wider text-brand-700">Total adeudado</div><div className="text-3xl font-bold text-brand-800">{bs(p.total)}</div></div></div>
        <p className="mt-8 text-xs text-ink-500">Este documento es informativo y no constituye comprobante de pago. Los montos pueden variar si se registran nuevas lecturas. Emitido por {p.usuario}.</p>
      </div>
    </div>
  );
}
