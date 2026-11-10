import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSession, verify } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { bs, cod, fechaHora, nombreCompleto, periodoLabel } from "@/lib/format";
import PrintButton from "@/components/PrintButton";
export const dynamic = "force-dynamic";

export default async function Recibo({ params, searchParams }: { params: { id: string }; searchParams: { t?: string; formato?: string } }) {
  const p = await q1(`SELECT p.*, so.nombres, so.apellidos, so.ci, so.direccion, so.numero nro, z.nombre zona, u.nombre cajero FROM pagos p JOIN socios so ON so.id=p.socio_id JOIN zonas z ON z.id=so.zona_id LEFT JOIN usuarios u ON u.id=p.cajero_id WHERE p.id=$1`, [Number(params.id)]);
  if (!p) notFound();
  const ses = await getSession(); const tok = await verify<{ socioId: number }>(searchParams.t);
  if (!(ses && ses.rol !== "SOCIO") && !(tok?.socioId === p.socio_id) && !(ses?.socioId === p.socio_id)) redirect("/login");
  const [cfg, det] = await Promise.all([getConfig(), q(`SELECT c.*, m.numero FROM cargos c JOIN medidores m ON m.id=c.medidor_id WHERE c.pago_id=$1 ORDER BY c.periodo, m.numero`, [p.id])]);
  const qr = await QRCode.toDataURL(`RECIBO|${cod(p.id, 6)}|${p.total}|${p.socio_id}`, { margin: 0, width: 120 });
  const ticket = searchParams.formato === "ticket";
  return (
    <div className="min-h-screen bg-ink-100 p-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <div className="flex gap-2 text-sm"><a href="?formato=a5" className="btn-ghost !py-1.5">Hoja carta</a><a href="?formato=ticket" className="btn-ghost !py-1.5">Ticket 80 mm</a></div><PrintButton label="Imprimir comprobante" />
      </div>
      <div className={`print-sheet relative mx-auto bg-white shadow-card ring-1 ring-ink-100 ${ticket ? "max-w-[320px] p-4 text-xs" : "max-w-3xl p-10"}`}>
        {p.anulado && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-black uppercase tracking-widest text-rose-500/20 -rotate-12">Anulado</div>}
        <div className="flex items-start justify-between border-b border-ink-100 pb-5">
          <div><div className="text-lg font-bold">{cfg.nombre}</div><div className="text-xs text-ink-500">Comprobante de pago · Servicio de agua potable</div></div>
          <div className="text-right"><div className="text-xs uppercase tracking-wider text-ink-500">Recibo N°</div><div className="font-mono text-xl font-bold">{cod(p.id, 6)}</div></div>
        </div>
        <div className={`mt-5 grid gap-3 text-sm ${ticket ? "" : "grid-cols-2"}`}>
          <div><span className="text-ink-500">Socio: </span><b>{nombreCompleto(p)}</b></div><div><span className="text-ink-500">CI: </span>{p.ci}</div>
          <div><span className="text-ink-500">Dirección: </span>{p.direccion}{p.nro ? ` N° ${p.nro}` : ""} ({p.zona})</div><div><span className="text-ink-500">Fecha: </span>{fechaHora(p.fecha)}</div>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead><tr className="border-b border-ink-300 text-left text-[11px] uppercase tracking-wider text-ink-500"><th className="py-2">Periodo</th><th>Medidor</th><th className="text-right">Consumo</th><th className="text-right">Base</th><th className="text-right">Exceso</th><th className="text-right">Importe</th></tr></thead>
          <tbody>{det.map((d) => (
            <tr key={d.id} className="border-b border-ink-100"><td className="py-2">{periodoLabel(d.periodo)}</td><td className="font-mono text-xs">{d.numero}</td><td className="text-right">{d.consumo ? `${d.consumo} m³` : "Fijo"}</td><td className="text-right">{bs(d.base)}</td><td className="text-right">{bs(d.exceso)}</td><td className="text-right font-semibold">{bs(d.total)}</td></tr>))}</tbody>
        </table>
        <div className="mt-5 flex items-end justify-between">
          <div className="flex items-center gap-3"><img src={qr} alt="" className="h-20 w-20" /><div className="text-xs text-ink-500">Método: <b className="text-ink-900">{p.metodo}</b><br />Cajero: {p.cajero ?? "Pago QR en línea"}</div></div>
          <div className="text-right"><div className="text-xs uppercase tracking-wider text-ink-500">Total pagado</div><div className="text-3xl font-bold text-brand-700">{bs(p.total)}</div></div>
        </div>
        {!ticket && <div className="mt-14 grid grid-cols-2 gap-16 text-center text-xs text-ink-500"><div className="border-t border-ink-300 pt-2">Firma del cajero</div><div className="border-t border-ink-300 pt-2">Firma del socio</div></div>}
        <p className="mt-6 text-center text-[11px] text-ink-500">Conserve este comprobante. Gracias por su pago puntual.</p>
      </div>
    </div>
  );
}
