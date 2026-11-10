import { requireRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { guardarUsuario } from "@/app/actions";
import { PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";
const ROLES = [["ADMIN", "Administrador"], ["GERENTE", "Gerente"], ["LECTOR", "Lector"], ["CAJERO", "Cajero"], ["SOCIO", "Socio"]];

function Fields({ u, zonas }: { u?: any; zonas: any[] }) {
  return (
    <>
      {u && <input type="hidden" name="id" value={u.id} />}
      <div><label className="label">Nombre</label><input name="nombre" required defaultValue={u?.nombre} className="input" /></div>
      <div><label className="label">Correo</label><input name="email" type="email" required defaultValue={u?.email} className="input" /></div>
      <div><label className="label">Rol</label><select name="rol" defaultValue={u?.rol ?? "CAJERO"} className="input">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div><label className="label">Zona (lector)</label><select name="zona_id" defaultValue={u?.zona_id ?? ""} className="input"><option value="">—</option>{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></div>
      <div><label className="label">Código de socio (rol Socio)</label><input name="socio_id" type="number" defaultValue={u?.socio_id ?? ""} className="input" /></div>
      <div><label className="label">{u ? "Nueva contraseña" : "Contraseña"}</label><input name="password" type="password" placeholder={u ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"} className="input" /></div>
    </>
  );
}
export default async function Usuarios() {
  await requireRole(["ADMIN"]);
  const [users, zonas] = await Promise.all([q(`SELECT u.*, z.nombre zona FROM usuarios u LEFT JOIN zonas z ON z.id=u.zona_id ORDER BY u.rol, u.nombre`), q("SELECT id,nombre FROM zonas ORDER BY nombre")]);
  return (
    <>
      <PageHeader title="Usuarios y roles" sub="Cree usuarios del sistema y asigne su perfil" />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card divide-y divide-ink-100 xl:col-span-2">
          {users.map((u) => (
            <details key={u.id} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <div><div className="font-semibold">{u.nombre}</div><div className="text-xs text-ink-500">{u.email}{u.zona ? ` · ${u.zona}` : ""}</div></div>
                <div className="flex gap-2"><span className="badge-info">{ROLES.find((r) => r[0] === u.rol)![1]}</span><span className={u.activo ? "badge-ok" : "badge-bad"}>{u.activo ? "Activo" : "Inactivo"}</span></div>
              </summary>
              <form action={guardarUsuario} className="mt-4 grid gap-3 sm:grid-cols-2"><Fields u={u} zonas={zonas} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={u.activo} />Usuario activo</label><button className="btn-primary sm:col-span-2">Guardar</button></form>
            </details>))}
        </div>
        <form action={guardarUsuario} className="card space-y-3 p-6"><h2 className="font-semibold">Nuevo usuario</h2><Fields zonas={zonas} /><button className="btn-primary w-full">Crear usuario</button></form>
      </div>
    </>
  );
}
