import Link from "next/link";
import { requireRole, getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import { generarFijos } from "@/app/actions";
import { periodoActual, periodoLabel, periodoAnterior, nombreCompleto } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import LecturaRow from "@/components/LecturaRow";
import { AlertCircle } from "lucide-react";
export const dynamic = "force-dynamic";

export default async function Lecturas({ searchParams }: { searchParams: { periodo?: string; zona?: string; q?: string } }) {
  const s = await requireRole(["ADMIN", "GERENTE", "LECTOR"]);
  const session = await getSession();
  const rol = session?.rol ?? s.rol;
  const periodo = /^\d{4}-\d{2}$/.test(searchParams.periodo ?? "") ? searchParams.periodo! : periodoActual();
  const zona = s.rol === "LECTOR" && s.zonaId ? s.zonaId : searchParams.zona ? Number(searchParams.zona) : null;
  const term = `%${searchParams.q ?? ""}%`;
  const [zonas, rows, fijos] = await Promise.all([
    q("SELECT id,nombre FROM zonas ORDER BY nombre"),
    q(`SELECT m.id, m.numero, so.nombres, so.apellidos, so.direccion, so.numero nro, z.nombre zona,
        COALESCE((SELECT actual FROM lecturas l WHERE l.medidor_id=m.id AND l.periodo<$1 ORDER BY periodo DESC LIMIT 1), m.lectura_inicial) anterior,
        (SELECT actual FROM lecturas l WHERE l.medidor_id=m.id AND l.periodo=$1) actual,
        EXISTS (SELECT 1 FROM cargos c WHERE c.medidor_id=m.id AND c.periodo=$1 AND c.estado='PAGADO') pagado,
        t.tipo, t.cargo_minimo, t.m3_minimos, t.tramos
       FROM medidores m JOIN socios so ON so.id=m.socio_id JOIN zonas z ON z.id=so.zona_id JOIN tarifarios t ON t.id=m.tarifario_id
       WHERE m.estado='ACTIVO' AND t.tipo='CONSUMO' AND ($2::int IS NULL OR so.zona_id=$2) AND (so.nombres||' '||so.apellidos||' '||m.numero ILIKE $3)
       ORDER BY z.nombre, so.apellidos, m.numero`, [periodo, zona, term]),
    q(`SELECT count(*) n FROM medidores m JOIN tarifarios t ON t.id=m.tarifario_id WHERE m.estado='ACTIVO' AND t.tipo='FIJA'`),
  ]);
  const hechas = rows.filter((r) => r.actual !== null).length;
  return (
    <>
      <PageHeader title="Lecturas de medidores" sub={`${periodoLabel(periodo)} · ${hechas} de ${rows.length} registradas`}>
        {s.rol !== "LECTOR" && fijos[0].n > 0 && (
          <form action={generarFijos}><input type="hidden" name="periodo" value={periodo} /><button className="btn-ghost">Generar cargos fijos ({fijos[0].n})</button></form>)}
      </PageHeader>
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div><label className="label">Periodo</label><input type="month" name="periodo" defaultValue={periodo} className="input" /></div>
        {s.rol !== "LECTOR" && <div><label className="label">Zona</label><select name="zona" defaultValue={zona ?? ""} className="input w-48"><option value="">Todas</option>{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></div>}
        <div className="min-w-[200px] flex-1"><label className="label">Buscar</label><input name="q" defaultValue={searchParams.q} placeholder="Socio o N° de medidor" className="input" /></div>
        <button className="btn-primary">Filtrar</button><Link href={`/lecturas?periodo=${periodoAnterior(periodo)}`} className="btn-ghost">← Mes anterior</Link>
      </form>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${rows.length ? (hechas / rows.length) * 100 : 0}%` }} /></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead><tr><th className="th">Medidor</th><th className="th">Socio</th><th className="th text-right">Anterior</th><th className="th text-right">Lectura actual</th><th className="th text-right">Consumo</th><th className="th text-right">Importe</th><th className="th text-right">Estado</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => <LecturaRow key={r.id + periodo} periodo={periodo} rol={rol} m={{ id: r.id, numero: r.numero, socio: nombreCompleto(r), direccion: r.direccion, zona: r.zona, anterior: r.anterior, actual: r.actual, pagado: r.pagado, tarifa: { tipo: r.tipo, cargo_minimo: r.cargo_minimo, m3_minimos: r.m3_minimos, tramos: r.tramos } }} />)}
          </tbody>
        </table>
      </div>
      {rol === "LECTOR" && <div className="card p-3 mt-3 text-sm text-ink-600"><p className="mb-1"><AlertCircle className="inline h-4 w-4 mr-2" /> Regla de negocio:</p><ul className="list-disc pl-4 space-y-1"><li>Solo puede registrar nuevas lecturas.</li><li>Una vez registrada, solo puede modificar una vez y con justificación.</li><li>No puede eliminar lecturas.</li></ul></div>}
    </>
  );
}
