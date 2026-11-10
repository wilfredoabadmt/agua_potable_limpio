import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { bs, cod, fechaHora, nombreCompleto, periodoActual, periodoLabel } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
export const dynamic = "force-dynamic";
const TABS = [["deudores", "Deudores"], ["no-deudores", "No deudores"], ["recaudacion", "Recaudación"], ["faltantes", "Lecturas faltantes"], ["anulaciones", "Anulaciones"], ["zonas", "Resultados por zona"]];

export default async function Reportes({ searchParams }: { searchParams: { r?: string; periodo?: string; desde?: string; hasta?: string } }) {
  await requireRole(["ADMIN", "GERENTE"]);
  const r = searchParams.r ?? "deudores", periodo = searchParams.periodo ?? periodoActual();
  const desde = searchParams.desde || `${periodo}-01`, hasta = searchParams.hasta || "2999-12-31";
  let head: string[] = [], rows: (string | number)[][] = [], foot = "";
  if (r === "deudores") {
    const d = await q(`SELECT so.id,so.nombres,so.apellidos,so.ci,z.nombre zona,count(DISTINCT c.periodo) meses,sum(c.total) total FROM cargos c JOIN socios so ON so.id=c.socio_id JOIN zonas z ON z.id=so.zona_id WHERE c.estado='PENDIENTE' GROUP BY so.id,z.nombre ORDER BY total DESC`);
    head = ["Código", "Socio", "CI", "Zona", "Meses", "Deuda"]; rows = d.map((x) => [cod(x.id), nombreCompleto(x), x.ci, x.zona, x.meses, bs(x.total)]); foot = `Total adeudado: ${bs(d.reduce((a, x) => a + x.total, 0))}`;
  } else if (r === "no-deudores") {
    const d = await q(`SELECT so.id,so.nombres,so.apellidos,so.ci,z.nombre zona,(SELECT max(fecha) FROM pagos p WHERE p.socio_id=so.id AND NOT p.anulado) ultimo FROM socios so JOIN zonas z ON z.id=so.zona_id WHERE so.activo AND NOT EXISTS (SELECT 1 FROM cargos c WHERE c.socio_id=so.id AND c.estado='PENDIENTE') ORDER BY so.apellidos`);
    head = ["Código", "Socio", "CI", "Zona", "Último pago"]; rows = d.map((x) => [cod(x.id), nombreCompleto(x), x.ci, x.zona, x.ultimo ? fechaHora(x.ultimo) : "—"]);
  } else if (r === "recaudacion") {
    const d = await q(`SELECT p.id,p.fecha,p.metodo,p.total,so.nombres,so.apellidos,COALESCE(u.nombre,'QR en línea') cajero FROM pagos p JOIN socios so ON so.id=p.socio_id LEFT JOIN usuarios u ON u.id=p.cajero_id WHERE NOT p.anulado AND p.fecha::date BETWEEN $1 AND $2 ORDER BY p.fecha DESC`, [desde, hasta]);
    head = ["Recibo", "Fecha", "Socio", "Método", "Cajero", "Monto"]; rows = d.map((x) => [`N° ${cod(x.id, 6)}`, fechaHora(x.fecha), nombreCompleto(x), x.metodo, x.cajero, bs(x.total)]); foot = `Recaudación del periodo: ${bs(d.reduce((a, x) => a + x.total, 0))}`;
  } else if (r === "faltantes") {
    const d = await q(`SELECT m.numero,so.nombres,so.apellidos,so.direccion,z.nombre zona FROM medidores m JOIN socios so ON so.id=m.socio_id JOIN zonas z ON z.id=so.zona_id JOIN tarifarios t ON t.id=m.tarifario_id WHERE m.estado='ACTIVO' AND t.tipo='CONSUMO' AND NOT EXISTS (SELECT 1 FROM lecturas l WHERE l.medidor_id=m.id AND l.periodo=$1) ORDER BY z.nombre,so.apellidos`, [periodo]);
    head = ["Medidor", "Socio", "Dirección", "Zona"]; rows = d.map((x) => [x.numero, nombreCompleto(x), x.direccion, x.zona]); foot = `${d.length} lecturas faltantes en ${periodoLabel(periodo)}`;
  } else if (r === "anulaciones") {
    const d = await q(`SELECT p.id,p.fecha,p.total,p.motivo_anulacion,so.nombres,so.apellidos FROM pagos p JOIN socios so ON so.id=p.socio_id WHERE p.anulado ORDER BY p.fecha DESC`);
    head = ["Recibo", "Fecha", "Socio", "Monto", "Motivo"]; rows = d.map((x) => [`N° ${cod(x.id, 6)}`, fechaHora(x.fecha), nombreCompleto(x), bs(x.total), x.motivo_anulacion ?? "—"]);
  } else {
    const d = await q(`SELECT z.nombre, count(DISTINCT so.id) socios, COALESCE((SELECT sum(p.total) FROM pagos p JOIN socios s2 ON s2.id=p.socio_id WHERE s2.zona_id=z.id AND NOT p.anulado),0) cobrado,
      COALESCE((SELECT sum(c.total) FROM cargos c JOIN socios s3 ON s3.id=c.socio_id WHERE s3.zona_id=z.id AND c.estado='PENDIENTE'),0) deuda FROM zonas z LEFT JOIN socios so ON so.zona_id=z.id GROUP BY z.id ORDER BY z.nombre`);
    head = ["Zona", "Socios", "Cobrado", "Deuda", "Cumplimiento"]; rows = d.map((x) => [x.nombre, x.socios, bs(x.cobrado), bs(x.deuda), `${Math.round((x.cobrado / Math.max(1, x.cobrado + x.deuda)) * 100)}%`]);
  }
  return (
    <>
      <PageHeader title="Reportes" sub="Deudores, recaudación, lecturas y resultados"><PrintButton label="Imprimir reporte" /></PageHeader>
      <div className="no-print mb-4 flex flex-wrap gap-2">{TABS.map(([k, l]) => <Link key={k} href={`/reportes?r=${k}&periodo=${periodo}`} className={r === k ? "btn-dark !py-2" : "btn-ghost !py-2"}>{l}</Link>)}</div>
      {(r === "faltantes" || r === "recaudacion") && (
        <form className="card no-print mb-4 flex flex-wrap items-end gap-3 p-4"><input type="hidden" name="r" value={r} />
          <div><label className="label">Periodo</label><input type="month" name="periodo" defaultValue={periodo} className="input" /></div>
          {r === "recaudacion" && <><div><label className="label">Desde</label><input type="date" name="desde" defaultValue={searchParams.desde} className="input" /></div><div><label className="label">Hasta</label><input type="date" name="hasta" defaultValue={searchParams.hasta} className="input" /></div></>}
          <button className="btn-primary">Aplicar</button></form>)}
      <div className="card print-sheet overflow-x-auto">
        <table className="w-full min-w-[640px]"><thead><tr>{head.map((h, i) => <th key={h} className={`th ${i === head.length - 1 && ["Deuda", "Monto", "Cumplimiento"].includes(h) ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-100">{rows.length === 0 && <tr><td colSpan={head.length}><Empty>Sin datos para este reporte.</Empty></td></tr>}
            {rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className={`td ${j === row.length - 1 && ["Deuda", "Monto", "Cumplimiento"].includes(head[j]) ? "text-right font-semibold" : ""}`}>{c}</td>)}</tr>)}</tbody></table>
        {foot && <div className="border-t border-ink-100 px-4 py-3 text-right text-sm font-bold">{foot}</div>}
      </div>
    </>
  );
}
