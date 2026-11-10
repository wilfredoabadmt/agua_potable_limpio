import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { bs, cod, nombreCompleto } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import { MoreVertical } from "lucide-react";
export const dynamic = "force-dynamic";
const PER = 10;

export default async function Socios({ searchParams }: { searchParams: { q?: string; zona?: string; page?: string } }) {
  const s = await requireRole(["ADMIN", "GERENTE", "CAJERO"]);
  const term = `%${(searchParams.q ?? "").trim()}%`, zona = searchParams.zona ? Number(searchParams.zona) : null, page = Math.max(1, Number(searchParams.page ?? 1));
  const where = `WHERE (so.nombres||' '||so.apellidos||' '||so.ci ILIKE $1 OR lpad(so.id::text,5,'0') LIKE $1) AND ($2::int IS NULL OR so.zona_id=$2)`;
  const [zonas, total, rows] = await Promise.all([
    q("SELECT id,nombre FROM zonas ORDER BY nombre"),
    q1(`SELECT count(*) n FROM socios so ${where}`, [term, zona]),
    q(`SELECT so.*, z.nombre zona, (SELECT count(*) FROM medidores m WHERE m.socio_id=so.id AND m.estado<>'BAJA') medidores,
        (SELECT COALESCE(sum(total),0) FROM cargos c WHERE c.socio_id=so.id AND c.estado='PENDIENTE') deuda
       FROM socios so JOIN zonas z ON z.id=so.zona_id ${where} ORDER BY so.id LIMIT ${PER} OFFSET ${(page - 1) * PER}`, [term, zona]),
  ]);
  const pages = Math.max(1, Math.ceil(total!.n / PER));
  const href = (p: number) => `/socios?q=${encodeURIComponent(searchParams.q ?? "")}&zona=${searchParams.zona ?? ""}&page=${p}`;
  const canEdit = s.rol !== "CAJERO";
  return (
    <>
      <PageHeader title="Socios" sub={`${total!.n} registrados`}>{canEdit && <Link href="/socios/nuevo" className="btn-primary">+ Nuevo socio</Link>}</PageHeader>
      <form className="card mb-4 flex flex-wrap gap-3 p-4">
        <input name="q" defaultValue={searchParams.q} placeholder="Buscar por nombre, CI o código…" className="input min-w-[240px] flex-1" />
        <select name="zona" defaultValue={searchParams.zona ?? ""} className="input w-48"><option value="">Todas las zonas</option>{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select>
        <button className="btn-primary">Buscar</button><Link href="/socios" className="btn-ghost">Limpiar</Link>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead><tr><th className="th">Código</th><th className="th">Estado</th><th className="th">Socio</th><th className="th">Dirección</th><th className="th">Medidores</th><th className="th text-right">Deuda</th><th className="th text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 && <tr><td colSpan={7}><Empty>No se encontraron socios.</Empty></td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-ink-50/70">
                <td className="td font-mono text-xs">{cod(r.id)}</td>
                <td className="td"><span className={r.activo ? "badge-ok" : "badge-bad"}>{r.activo ? "Activo" : "Inactivo"}</span></td>
                <td className="td"><div className="font-semibold">{nombreCompleto(r)}</div><div className="text-xs text-ink-500">CI {r.ci}{r.complemento ? `-${r.complemento}` : ""} · {r.tipo === "JURIDICA" ? "Jurídica" : "Natural"}</div></td>
                <td className="td"><div>{r.direccion}{r.numero ? ` N° ${r.numero}` : ""}</div><div className="text-xs text-ink-500">{r.zona}</div></td>
                <td className="td"><span className="badge-info">{r.medidores} medidor{r.medidores === 1 ? "" : "es"}</span></td>
                <td className={`td text-right font-semibold ${r.deuda > 0 ? "text-rose-600" : "text-emerald-600"}`}>{bs(r.deuda)}</td>
                <td className="td text-right">
                  <details className="relative inline-block text-left">
                    <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg hover:bg-ink-100"><MoreVertical className="h-4 w-4" /></summary>
                    <div className="absolute right-0 z-10 mt-1 flex w-max gap-1 rounded-xl bg-white p-1.5 shadow-card ring-1 ring-ink-100">
                      <Link href={`/socios/${r.id}`} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-ink-100">Medidores</Link>
                      {canEdit && <Link href={`/socios/${r.id}#editar`} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-ink-100">Editar</Link>}
                      <Link href={`/recibos/nuevo?socio=${r.id}`} className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50">Cobrar</Link>
                      <Link href={`/proformas?socio=${r.id}`} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-ink-100">Proforma</Link>
                    </div>
                  </details>
                </td>
              </tr>))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-sm text-ink-500">
          <span>Página {page} de {pages} · Total {total!.n}</span>
          <div className="flex gap-2">{page > 1 && <Link className="btn-ghost !py-1.5" href={href(page - 1)}>Anterior</Link>}{page < pages && <Link className="btn-ghost !py-1.5" href={href(page + 1)}>Siguiente</Link>}</div>
        </div>
      </div>
    </>
  );
}
