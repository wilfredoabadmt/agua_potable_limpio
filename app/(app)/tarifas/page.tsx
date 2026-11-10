import { requireRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { guardarTarifario, moverTarifario } from "@/app/actions";
import { calcular, describir, Tarifa, Tramo } from "@/lib/tarifa";
import { bs } from "@/lib/format";
import { PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";

function Form({ t }: { t?: any }) {
  const tr: Tramo[] = t?.tramos ?? [];
  return (
    <form action={guardarTarifario} className="space-y-4">
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><label className="label">Nombre</label><input name="nombre" required defaultValue={t?.nombre} placeholder="Ej. Domiciliario con lectura" className="input" /></div>
        <div><label className="label">Tipo</label><select name="tipo" defaultValue={t?.tipo ?? "CONSUMO"} className="input"><option value="CONSUMO">Con lectura (por consumo)</option><option value="FIJA">Tarifa fija única</option></select></div>
        <div><label className="label">Cargo base (Bs)</label><input name="cargo_minimo" type="number" step="0.01" min={0} required defaultValue={t?.cargo_minimo ?? 15} className="input" /></div>
        <div><label className="label">m³ incluidos en el cargo base</label><input name="m3_minimos" type="number" min={0} defaultValue={t?.m3_minimos ?? 9} className="input" /></div>
      </div>
      <div><div className="label">Tramos por m³ adicional (solo tarifa con lectura)</div>
        <div className="grid gap-2 sm:grid-cols-3">{[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-3 gap-2 rounded-xl bg-ink-50 p-2.5 ring-1 ring-ink-100">
            <input name="desde" type="number" min={1} defaultValue={tr[i]?.desde ?? (i === 0 ? 10 : i === 1 ? 16 : "")} placeholder="Desde m³" className="input !px-2.5" />
            <input name="hasta" type="number" min={1} defaultValue={tr[i]?.hasta ?? (i === 0 ? 15 : "")} placeholder="Hasta (vacío = ∞)" className="input !px-2.5" />
            <input name="precio" type="number" step="0.01" min={0} defaultValue={tr[i]?.precio ?? (i === 0 ? 2 : i === 1 ? 3 : "")} placeholder="Bs/m³" className="input !px-2.5" />
          </div>))}</div></div>
      <button className="btn-primary">{t ? "Guardar cambios" : "Crear tarifario"}</button>
    </form>
  );
}
export default async function Tarifas() {
  await requireRole(["ADMIN", "GERENTE"]);
  const [tarifas, zonas, uso] = await Promise.all([
    q("SELECT * FROM tarifarios ORDER BY id"), q("SELECT id,nombre FROM zonas ORDER BY nombre"),
    q("SELECT tarifario_id id, count(*) n FROM medidores WHERE estado<>'BAJA' GROUP BY 1"),
  ]);
  const muestra = [5, 9, 12, 15, 20, 30];
  return (
    <>
      <PageHeader title="Catálogos y tarifas" sub="Tarifa fija única o tarifa con lectura por tramos de consumo" />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {tarifas.map((t) => (
            <div key={t.id} className="card p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div><div className="flex items-center gap-2"><h2 className="font-semibold">{t.nombre}</h2><span className={t.tipo === "FIJA" ? "badge-warn" : "badge-info"}>{t.tipo === "FIJA" ? "Fija" : "Con lectura"}</span></div><p className="mt-1 text-sm text-ink-500">{describir(t as Tarifa)}</p></div>
                <span className="badge-ok">{uso.find((u) => u.id === t.id)?.n ?? 0} medidores</span>
              </div>
              {t.tipo === "CONSUMO" && (
                <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{muestra.map((m) => (
                  <div key={m} className="rounded-xl bg-ink-50 px-3 py-2 text-center ring-1 ring-ink-100"><div className="text-[11px] text-ink-500">{m} m³</div><div className="text-sm font-bold">{bs(calcular(t as Tarifa, m).total)}</div></div>))}</div>)}
              <details><summary className="cursor-pointer text-sm font-semibold text-brand-700">Editar tarifario</summary><div className="mt-4"><Form t={t} /></div></details>
            </div>))}
        </div>
        <div className="space-y-6">
          <div className="card p-6"><h2 className="mb-4 font-semibold">Nuevo tarifario</h2><Form /></div>
          <form action={moverTarifario} className="card space-y-3 p-6">
            <h2 className="font-semibold">Asignar o quitar a los socios</h2>
            <p className="text-xs text-ink-500">Mueva en bloque los medidores de un tarifario a otro. Para “quitar” un tarifario, elija otro de destino.</p>
            <div><label className="label">Desde</label><select name="origen_id" className="input"><option value="">Cualquier tarifario</option>{tarifas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
            <div><label className="label">Hacia</label><select name="destino_id" className="input">{tarifas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
            <div><label className="label">Zona</label><select name="zona_id" className="input"><option value="">Todas las zonas</option>{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></div>
            <button className="btn-dark w-full">Aplicar</button>
          </form>
        </div>
      </div>
    </>
  );
}
