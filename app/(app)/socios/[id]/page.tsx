import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { guardarSocio, guardarMedidor } from "@/app/actions";
import { bs, cod, nombreCompleto, periodoLabel } from "@/lib/format";
import { describir } from "@/lib/tarifa";
import { PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";

export default async function SocioPage({ params }: { params: { id: string } }) {
  const s = await requireRole(["ADMIN", "GERENTE", "CAJERO"]);
  const nuevo = params.id === "nuevo";
  const socio = nuevo ? null : await q1("SELECT * FROM socios WHERE id=$1", [Number(params.id)]);
  if (!nuevo && !socio) notFound();
  const [zonas, tarifas, medidores, deudas] = await Promise.all([
    q("SELECT id,nombre FROM zonas ORDER BY nombre"), q("SELECT * FROM tarifarios WHERE activo ORDER BY nombre"),
    nuevo ? [] : q(`SELECT m.*, t.nombre tarifa, (SELECT actual FROM lecturas l WHERE l.medidor_id=m.id ORDER BY periodo DESC LIMIT 1) ultima,
        (SELECT COALESCE(sum(total),0) FROM cargos c WHERE c.medidor_id=m.id AND c.estado='PENDIENTE') deuda FROM medidores m JOIN tarifarios t ON t.id=m.tarifario_id WHERE m.socio_id=$1 ORDER BY m.id`, [Number(params.id)]),
    nuevo ? [] : q(`SELECT periodo, sum(total) total, count(*) n FROM cargos WHERE socio_id=$1 AND estado='PENDIENTE' GROUP BY periodo ORDER BY periodo`, [Number(params.id)]),
  ]);
  const edit = s.rol !== "CAJERO";
  const v = socio ?? ({} as any);
  return (
    <>
      <PageHeader title={nuevo ? "Nuevo socio" : nombreCompleto(socio)} sub={nuevo ? "Registre los datos y luego agregue sus medidores" : `Código ${cod(socio.id)} · CI ${socio.ci}`}>
        {!nuevo && <><Link href={`/recibos/nuevo?socio=${socio.id}`} className="btn-primary">Cobrar</Link><Link href={`/proformas?socio=${socio.id}`} className="btn-ghost">Proforma</Link></>}
        <Link href="/socios" className="btn-ghost">Volver</Link>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-5">
        <form action={guardarSocio} id="editar" className="card space-y-4 p-6 xl:col-span-2">
          <h2 className="font-semibold">Datos del socio</h2>
          {socio && <input type="hidden" name="id" value={socio.id} />}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nombres</label><input name="nombres" defaultValue={v.nombres} required disabled={!edit} className="input" /></div>
            <div><label className="label">Apellidos</label><input name="apellidos" defaultValue={v.apellidos} required disabled={!edit} className="input" /></div>
            <div><label className="label">CI</label><input name="ci" defaultValue={v.ci} required disabled={!edit} className="input" /></div>
            <div><label className="label">Complemento</label><input name="complemento" defaultValue={v.complemento ?? ""} disabled={!edit} className="input" placeholder="Opcional" /></div>
            <div><label className="label">Zona</label><select name="zona_id" defaultValue={v.zona_id} required disabled={!edit} className="input">{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></div>
            <div><label className="label">Tipo</label><select name="tipo" defaultValue={v.tipo ?? "NATURAL"} disabled={!edit} className="input"><option value="NATURAL">Natural</option><option value="JURIDICA">Jurídica</option></select></div>
            <div className="col-span-2"><label className="label">Dirección</label><input name="direccion" defaultValue={v.direccion} required disabled={!edit} className="input" /></div>
            <div><label className="label">N°</label><input name="numero" defaultValue={v.numero ?? ""} disabled={!edit} className="input" /></div>
            <div><label className="label">WhatsApp / celular</label><input name="celular" defaultValue={v.celular ?? ""} disabled={!edit} className="input" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={v.activo ?? true} disabled={!edit} />Socio activo</label>
          {edit && <button className="btn-primary w-full">{nuevo ? "Crear socio" : "Guardar cambios"}</button>}
        </form>
        <div className="space-y-6 xl:col-span-3">
          {nuevo ? <div className="card p-6 text-sm text-ink-500">Después de crear el socio podrá registrar uno o varios medidores y asignarles su tarifario.</div> : (
            <>
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between p-6 pb-3"><h2 className="font-semibold">Medidores ({medidores.length})</h2><span className="text-sm text-ink-500">Deuda total: <b className={deudas.length ? "text-rose-600" : "text-emerald-600"}>{bs(medidores.reduce((a, m) => a + m.deuda, 0))}</b></span></div>
                <div className="divide-y divide-ink-100">
                  {medidores.map((m) => (
                    <form action={guardarMedidor} key={m.id} className="grid items-end gap-3 px-6 py-4 sm:grid-cols-6">
                      <input type="hidden" name="id" value={m.id} /><input type="hidden" name="socio_id" value={socio.id} />
                      <div><label className="label">N° medidor</label><input name="numero" defaultValue={m.numero} disabled={!edit} className="input font-mono" /></div>
                      <div className="sm:col-span-2"><label className="label">Tarifario</label>
                        <select name="tarifario_id" defaultValue={m.tarifario_id} disabled={!edit} className="input">{tarifas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
                      <div><label className="label">Ubicación</label><input name="ubicacion" defaultValue={m.ubicacion ?? ""} disabled={!edit} className="input" placeholder="Ej. Casa 2" /></div>
                      <div><label className="label">Estado</label><select name="estado" defaultValue={m.estado} disabled={!edit} className="input"><option>ACTIVO</option><option>SUSPENDIDO</option><option>BAJA</option></select></div>
                      {edit ? <button className="btn-ghost">Guardar</button> : <div className="text-right text-sm font-semibold">{bs(m.deuda)}</div>}
                    </form>))}
                  {medidores.length === 0 && <div className="px-6 py-8 text-sm text-ink-500">Este socio todavía no tiene medidores.</div>}
                </div>
                {edit && (
                  <form action={guardarMedidor} className="grid items-end gap-3 border-t border-ink-100 bg-ink-50/70 px-6 py-4 sm:grid-cols-6">
                    <input type="hidden" name="socio_id" value={socio.id} />
                    <div><label className="label">Nuevo N°</label><input name="numero" required className="input font-mono" placeholder="M-0000" /></div>
                    <div className="sm:col-span-2"><label className="label">Tarifario</label><select name="tarifario_id" className="input">{tarifas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
                    <div><label className="label">Ubicación</label><input name="ubicacion" className="input" placeholder="Opcional" /></div>
                    <div><label className="label">Lect. inicial</label><input name="lectura_inicial" type="number" min={0} defaultValue={0} className="input" /></div>
                    <button className="btn-primary">+ Agregar</button>
                  </form>)}
              </div>
              <div className="card p-6">
                <h2 className="mb-3 font-semibold">Periodos adeudados</h2>
                {deudas.length === 0 ? <p className="text-sm text-emerald-600">Sin deudas pendientes.</p> : (
                  <div className="flex flex-wrap gap-2">{deudas.map((d) => <span key={d.periodo} className="badge-warn">{periodoLabel(d.periodo)} · {bs(d.total)}</span>)}</div>)}
                <p className="mt-4 text-xs text-ink-500">Tarifas disponibles: {tarifas.map((t) => `${t.nombre} (${describir(t)})`).join(" | ")}</p>
              </div>
            </>)}
        </div>
      </div>
    </>
  );
}
