import { requireRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { guardarZona } from "@/app/actions";
import { PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Zonas() {
  await requireRole(["ADMIN", "GERENTE"]);
  const zonas = await q(`SELECT z.*, (SELECT count(*) FROM socios s WHERE s.zona_id=z.id) socios FROM zonas z ORDER BY z.nombre`);
  return (
    <>
      <PageHeader title="Zonas" sub="Sectores de distribución del servicio" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card divide-y divide-ink-100 lg:col-span-2">
          {zonas.map((z) => (
            <form action={guardarZona} key={z.id} className="grid items-end gap-3 p-4 sm:grid-cols-6">
              <input type="hidden" name="id" value={z.id} />
              <div className="sm:col-span-2"><label className="label">Nombre</label><input name="nombre" defaultValue={z.nombre} className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Descripción</label><input name="descripcion" defaultValue={z.descripcion ?? ""} className="input" /></div>
              <div className="text-center"><span className="badge-info">{z.socios} socios</span></div><button className="btn-ghost">Guardar</button>
            </form>))}
        </div>
        <form action={guardarZona} className="card space-y-3 p-6"><h2 className="font-semibold">Nueva zona</h2>
          <div><label className="label">Nombre</label><input name="nombre" required className="input" /></div>
          <div><label className="label">Descripción</label><input name="descripcion" className="input" /></div><button className="btn-primary w-full">Crear zona</button></form>
      </div>
    </>
  );
}
