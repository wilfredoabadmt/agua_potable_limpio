"use server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q, q1, tx } from "@/lib/db";
import { createSession, requireRole, sign, verify, Rol } from "@/lib/auth";
import { calcular, Tarifa } from "@/lib/tarifa";
import { crearPago, confirmarQr } from "@/lib/pagos";
import { generarQr } from "@/lib/qr";
import { getConfig } from "@/lib/config";

const S = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const N = (fd: FormData, k: string) => (S(fd, k) === "" ? null : Number(S(fd, k)));
const audit = (u: string, accion: string, detalle: string) => q("INSERT INTO auditoria (usuario,accion,detalle) VALUES ($1,$2,$3)", [u, accion, detalle]);

/* ---------- Sesión ---------- */
export async function login(_: unknown, fd: FormData) {
  const u = await q1("SELECT * FROM usuarios WHERE email=$1 AND activo", [S(fd, "email").toLowerCase()]);
  if (!u || !(await bcrypt.compare(S(fd, "password"), u.password))) return { error: "Correo o contraseña incorrectos" };
  await createSession({ uid: u.id, nombre: u.nombre, rol: u.rol, zonaId: u.zona_id, socioId: u.socio_id });
  redirect(u.rol === "SOCIO" ? "/mi-cuenta" : "/dashboard");
}
export async function logout() { cookies().delete("sess"); redirect("/login"); }

/* ---------- Zonas ---------- */
export async function guardarZona(fd: FormData) {
  const s = await requireRole(["ADMIN", "GERENTE"]);
  const id = N(fd, "id");
  if (id) await q("UPDATE zonas SET nombre=$1, descripcion=$2 WHERE id=$3", [S(fd, "nombre"), S(fd, "descripcion"), id]);
  else await q("INSERT INTO zonas (nombre, descripcion) VALUES ($1,$2)", [S(fd, "nombre"), S(fd, "descripcion")]);
  await audit(s.nombre, "ZONA", S(fd, "nombre")); revalidatePath("/zonas");
}

/* ---------- Socios y medidores ---------- */
export async function guardarSocio(fd: FormData) {
  const s = await requireRole(["ADMIN", "GERENTE"]);
  const v = [S(fd, "nombres"), S(fd, "apellidos"), S(fd, "ci"), S(fd, "complemento") || null, N(fd, "zona_id"), S(fd, "direccion"), S(fd, "numero") || null, S(fd, "celular") || null, S(fd, "tipo") || "NATURAL", fd.get("activo") !== "off"];
  const id = N(fd, "id");
  let sid = id;
  if (id) await q(`UPDATE socios SET nombres=$1,apellidos=$2,ci=$3,complemento=$4,zona_id=$5,direccion=$6,numero=$7,celular=$8,tipo=$9,activo=$10 WHERE id=$11`, [...v, id]);
  else sid = (await q1(`INSERT INTO socios (nombres,apellidos,ci,complemento,zona_id,direccion,numero,celular,tipo,activo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, v))!.id;
  await audit(s.nombre, id ? "SOCIO_EDIT" : "SOCIO_NEW", `${v[1]} ${v[0]}`);
  revalidatePath("/socios"); redirect(`/socios/${sid}`);
}
export async function guardarMedidor(fd: FormData) {
  const s = await requireRole(["ADMIN", "GERENTE"]);
  const id = N(fd, "id"), socio = N(fd, "socio_id");
  try {
    if (id) await q(`UPDATE medidores SET numero=$1,tarifario_id=$2,ubicacion=$3,estado=$4 WHERE id=$5`, [S(fd, "numero"), N(fd, "tarifario_id"), S(fd, "ubicacion") || null, S(fd, "estado") || "ACTIVO", id]);
    else await q(`INSERT INTO medidores (numero,socio_id,tarifario_id,ubicacion,lectura_inicial) VALUES ($1,$2,$3,$4,$5)`, [S(fd, "numero"), socio, N(fd, "tarifario_id"), S(fd, "ubicacion") || null, N(fd, "lectura_inicial") ?? 0]);
  } catch { /* número de medidor duplicado */ }
  await audit(s.nombre, "MEDIDOR", S(fd, "numero")); revalidatePath(`/socios/${socio}`);
}

/* ---------- Tarifarios ---------- */
export async function guardarTarifario(fd: FormData) {
  const s = await requireRole(["ADMIN", "GERENTE"]);
  const d = fd.getAll("desde"), h = fd.getAll("hasta"), p = fd.getAll("precio");
  const tramos = S(fd, "tipo") === "FIJA" ? [] : d.map((x, i) => ({ desde: Number(x), hasta: String(h[i]) === "" ? null : Number(h[i]), precio: Number(p[i]) })).filter((t) => t.desde > 0 && t.precio >= 0);
  const v = [S(fd, "nombre"), S(fd, "tipo"), N(fd, "cargo_minimo") ?? 0, S(fd, "tipo") === "FIJA" ? 0 : N(fd, "m3_minimos") ?? 0, JSON.stringify(tramos)];
  const id = N(fd, "id");
  if (id) await q(`UPDATE tarifarios SET nombre=$1,tipo=$2,cargo_minimo=$3,m3_minimos=$4,tramos=$5 WHERE id=$6`, [...v, id]);
  else await q(`INSERT INTO tarifarios (nombre,tipo,cargo_minimo,m3_minimos,tramos) VALUES ($1,$2,$3,$4,$5)`, v);
  await audit(s.nombre, "TARIFARIO", S(fd, "nombre")); revalidatePath("/tarifas");
}
/** Asigna o quita tarifario en bloque: mueve medidores (de un tarifario origen o de todos) hacia el destino, opcionalmente por zona. */
export async function moverTarifario(fd: FormData) {
  const s = await requireRole(["ADMIN", "GERENTE"]);
  const r = await q(`UPDATE medidores m SET tarifario_id=$1 FROM socios so WHERE so.id=m.socio_id AND m.estado<>'BAJA'
    AND ($2::int IS NULL OR m.tarifario_id=$2) AND ($3::int IS NULL OR so.zona_id=$3) RETURNING m.id`, [N(fd, "destino_id"), N(fd, "origen_id"), N(fd, "zona_id")]);
  await audit(s.nombre, "TARIFARIO_MOVER", `${r.length} medidores → tarifario ${N(fd, "destino_id")}`); revalidatePath("/tarifas");
}

/* ---------- Lecturas ---------- */
export async function registrarLectura(medidorId: number, periodo: string, actual: number, justificacion?: string) {
  if (!Number.isInteger(medidorId) || medidorId <= 0) return { ok: false, msg: "Medidor inválido" };
  const s = await requireRole(["ADMIN", "GERENTE", "LECTOR"]);
  const m = await q1(`SELECT m.*, so.zona_id, t.tipo, t.cargo_minimo, t.m3_minimos, t.tramos FROM medidores m JOIN socios so ON so.id=m.socio_id JOIN tarifarios t ON t.id=m.tarifario_id WHERE m.id=$1`, [medidorId]);
  if (!m || m.estado !== "ACTIVO") return { ok: false, msg: "Medidor no disponible" };
  if (s.rol === "LECTOR" && s.zonaId && m.zona_id !== s.zonaId) return { ok: false, msg: "Fuera de su zona asignada" };
  if (!Number.isInteger(actual) || actual < 0) return { ok: false, msg: "Lectura inválida" };
  const prev = await q1(`SELECT actual FROM lecturas WHERE medidor_id=$1 AND periodo<$2 ORDER BY periodo DESC LIMIT 1`, [medidorId, periodo]);
  const anterior = prev?.actual ?? m.lectura_inicial;
  if (actual < anterior) return { ok: false, msg: `Debe ser ≥ ${anterior} (lectura anterior)` };
  const paid = await q1(`SELECT 1 FROM cargos WHERE medidor_id=$1 AND periodo=$2 AND estado='PAGADO'`, [medidorId, periodo]);
  if (paid) return { ok: false, msg: "El periodo ya fue cobrado" };

  // Verificar si ya existe una lectura para este periodo
  const lecturaExistente = await q1(`SELECT id, modificaciones, observacion FROM lecturas WHERE medidor_id=$1 AND periodo=$2`, [medidorId, periodo]);
  
  if (lecturaExistente) {
    // Es una modificación de lectura existente
    if (s.rol === "LECTOR") {
      if (lecturaExistente.modificaciones >= 1) {
        return { ok: false, msg: "Solo se permite una modificación por lector" };
      }
      if (!justificacion || justificacion.trim().length < 3) {
        return { ok: false, msg: "Justificación requerida para modificar la lectura" };
      }
    }
  }

  const consumo = actual - anterior;
  const c = calcular(m as Tarifa, consumo);
  await tx(async (cx) => {
    await cx.query(`INSERT INTO lecturas (medidor_id,periodo,anterior,actual,consumo,lector_id,observacion,modificaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (medidor_id,periodo) DO UPDATE SET anterior=$3, actual=$4, consumo=$5, lector_id=$6, fecha=now(), observacion=$7, modificaciones=lecturas.modificaciones+1`, [medidorId, periodo, anterior, actual, consumo, s.uid, justificacion ?? null, lecturaExistente ? 1 : 0]);
    await cx.query(`INSERT INTO cargos (medidor_id,socio_id,periodo,consumo,base,exceso,total) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (medidor_id,periodo) DO UPDATE SET consumo=$4, base=$5, exceso=$6, total=$7 WHERE cargos.estado='PENDIENTE'`, [medidorId, m.socio_id, periodo, consumo, c.base, c.exceso, c.total]);
  });
  await audit(s.nombre, lecturaExistente ? "LECTURA_MOD" : "LECTURA_NEW", `Medidor ${medidorId} periodo ${periodo} ${justificacion ? "(just: "+justificacion+")" : ""}`);
  return { ok: true, msg: "Guardado", consumo, total: c.total, anterior };
}

/** Modificar lectura existente con justificación (solo ADMIN/GERENTE). */
export async function modificarLectura(medidorId: number, periodo: string, actual: number, justificacion: string) {
  if (!Number.isInteger(medidorId) || medidorId <= 0) return { ok: false, msg: "Medidor inválido" };
  const s = await requireRole(["ADMIN", "GERENTE"]);
  const m = await q1(`SELECT m.*, so.zona_id, t.tipo, t.cargo_minimo, t.m3_minimos, t.tramos FROM medidores m JOIN socios so ON so.id=m.socio_id JOIN tarifarios t ON t.id=m.tarifario_id WHERE m.id=$1`, [medidorId]);
  if (!m || m.estado !== "ACTIVO") return { ok: false, msg: "Medidor no disponible" };
  if (!justificacion || justificacion.trim().length < 3) return { ok: false, msg: "Justificación requerida" };
  if (!Number.isInteger(actual) || actual < 0) return { ok: false, msg: "Lectura inválida" };
  const prev = await q1(`SELECT actual FROM lecturas WHERE medidor_id=$1 AND periodo<$2 ORDER BY periodo DESC LIMIT 1`, [medidorId, periodo]);
  const anterior = prev?.actual ?? m.lectura_inicial;
  if (actual < anterior) return { ok: false, msg: `Debe ser ≥ ${anterior} (lectura anterior)` };
  const paid = await q1(`SELECT 1 FROM cargos WHERE medidor_id=$1 AND periodo=$2 AND estado='PAGADO'`, [medidorId, periodo]);
  if (paid) return { ok: false, msg: "El periodo ya fue cobrado" };
  const consumo = actual - anterior;
  const c = calcular(m as Tarifa, consumo);
  await tx(async (cx) => {
    await cx.query(`INSERT INTO lecturas (medidor_id,periodo,anterior,actual,consumo,lector_id,observacion,modificaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (medidor_id,periodo) DO UPDATE SET anterior=$3, actual=$4, consumo=$5, lector_id=$6, fecha=now(), observacion=$7, modificaciones=lecturas.modificaciones+1`, [medidorId, periodo, anterior, actual, consumo, s.uid, justificacion.trim(), 1]);
    await cx.query(`INSERT INTO cargos (medidor_id,socio_id,periodo,consumo,base,exceso,total) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (medidor_id,periodo) DO UPDATE SET consumo=$4, base=$5, exceso=$6, total=$7 WHERE cargos.estado='PENDIENTE'`, [medidorId, m.socio_id, periodo, consumo, c.base, c.exceso, c.total]);
  });
  await audit(s.nombre, "LECTURA_MOD_ADMIN", `Medidor ${medidorId} periodo ${periodo} just: ${justificacion.trim()}`);
  return { ok: true, msg: "Modificada", consumo, total: c.total, anterior };
}

/** Eliminar lectura (solo ADMIN/GERENTE, solo si no está pagada). */
export async function eliminarLectura(medidorId: number, periodo: string) {
  if (!Number.isInteger(medidorId) || medidorId <= 0) return { ok: false, msg: "Medidor inválido" };
  const s = await requireRole(["ADMIN", "GERENTE"]);
  const paid = await q1(`SELECT 1 FROM cargos WHERE medidor_id=$1 AND periodo=$2 AND estado='PAGADO'`, [medidorId, periodo]);
  if (paid) return { ok: false, msg: "No se puede eliminar: periodo ya cobrado" };
  await tx(async (cx) => {
    await cx.query(`DELETE FROM cargos WHERE medidor_id=$1 AND periodo=$2`, [medidorId, periodo]);
    await cx.query(`DELETE FROM lecturas WHERE medidor_id=$1 AND periodo=$2`, [medidorId, periodo]);
  });
  await audit(s.nombre, "LECTURA_DEL", `Medidor ${medidorId} periodo ${periodo}`);
  return { ok: true, msg: "Eliminada" };
}

/** Genera los cargos del periodo para medidores con tarifa FIJA (no requieren lectura). */
export async function generarFijos(fd: FormData) {
  await requireRole(["ADMIN", "GERENTE"]);
  const p = S(fd, "periodo");
  await q(`INSERT INTO cargos (medidor_id,socio_id,periodo,consumo,base,exceso,total)
    SELECT m.id, m.socio_id, $1, 0, t.cargo_minimo, 0, t.cargo_minimo FROM medidores m JOIN tarifarios t ON t.id=m.tarifario_id
    WHERE m.estado='ACTIVO' AND t.tipo='FIJA' ON CONFLICT DO NOTHING`, [p]);
  revalidatePath("/lecturas");
}

/* ---------- Cobros, anulaciones, proformas ---------- */
export async function procesarPago(socioId: number, cargoIds: number[], metodo: "EFECTIVO" | "QR" | "TRANSFERENCIA") {
  if (!Number.isInteger(socioId) || socioId <= 0) return { error: "Socio inválido" };
  if (!cargoIds.length || cargoIds.some((id) => !Number.isInteger(id) || id <= 0)) return { error: "Seleccione al menos un medidor" };
  const s = await requireRole(["ADMIN", "GERENTE", "CAJERO"]);
  try { return { pagoId: await crearPago({ socioId, cargoIds, metodo, cajeroId: s.uid, usuario: s.nombre }) }; }
  catch (e: any) { return { error: e.message as string }; }
}
export async function anularPago(fd: FormData) {
  const s = await requireRole(["ADMIN", "GERENTE"]);
  const id = N(fd, "id")!;
  await tx(async (c) => {
    await c.query(`UPDATE pagos SET anulado=true, motivo_anulacion=$1 WHERE id=$2 AND NOT anulado`, [S(fd, "motivo") || "Sin motivo", id]);
    await c.query(`UPDATE cargos SET estado='PENDIENTE', pago_id=NULL WHERE pago_id=$1`, [id]);
  });
  await audit(s.nombre, "ANULACION", `Pago #${id}: ${S(fd, "motivo")}`); revalidatePath("/recibos");
}
export async function crearProforma(fd: FormData) {
  const s = await requireRole(["ADMIN", "GERENTE", "CAJERO"]);
  const socio = N(fd, "socio_id")!;
  const ids = fd.getAll("cargo").map(Number);
  const rows = await q(`SELECT id,total FROM cargos WHERE socio_id=$1 AND estado='PENDIENTE' AND ($2::int[] = '{}' OR id = ANY($2))`, [socio, ids]);
  if (!rows.length) redirect(`/proformas?socio=${socio}`);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const p = await q1(`INSERT INTO proformas (socio_id,cargo_ids,total,vigente_hasta,usuario) VALUES ($1,$2,$3, current_date + 15, $4) RETURNING id`, [socio, rows.map((r) => r.id), total, s.nombre]);
  redirect(`/imprimir/proforma/${p!.id}`);
}

/* ---------- Administración ---------- */
export async function guardarUsuario(fd: FormData) {
  const s = await requireRole(["ADMIN"]);
  const id = N(fd, "id"), pass = S(fd, "password");
  const v = [S(fd, "nombre"), S(fd, "email").toLowerCase(), S(fd, "rol") as Rol, N(fd, "zona_id"), N(fd, "socio_id"), fd.get("activo") !== "off"];
  if (id) {
    await q(`UPDATE usuarios SET nombre=$1,email=$2,rol=$3,zona_id=$4,socio_id=$5,activo=$6 WHERE id=$7`, [...v, id]);
    if (pass) await q(`UPDATE usuarios SET password=$1 WHERE id=$2`, [await bcrypt.hash(pass, 10), id]);
  } else await q(`INSERT INTO usuarios (nombre,email,rol,zona_id,socio_id,activo,password) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [...v, await bcrypt.hash(pass || "cambiar123", 10)]);
  await audit(s.nombre, "USUARIO", S(fd, "email")); revalidatePath("/admin/usuarios");
}
export async function guardarConfig(fd: FormData) {
  const s = await requireRole(["ADMIN"]);
  const f = fd.get("logo") as File | null;
  let logo: string | null = null;
  if (f && f.size > 0 && f.size < 300_000) logo = `data:${f.type};base64,${Buffer.from(await f.arrayBuffer()).toString("base64")}`;
  await q(`UPDATE config SET nombre=$1, moneda=$2, vencimiento_dia=$3, logo_url=COALESCE($4, logo_url) WHERE id=1`, [S(fd, "nombre"), S(fd, "moneda") || "Bs", N(fd, "vencimiento_dia") ?? 15, logo]);
  await audit(s.nombre, "CONFIG", S(fd, "nombre")); revalidatePath("/", "layout");
}
export async function guardarQr(fd: FormData) {
  const s = await requireRole(["ADMIN"]);
  await q(`UPDATE config SET qr_activo=$1, qr_sandbox=$2, qr_proveedor=$3, qr_url_base=$4, qr_api_key=COALESCE(NULLIF($5,''), qr_api_key), qr_webhook_secret=$6 WHERE id=1`,
    [fd.get("qr_activo") === "on", fd.get("qr_sandbox") === "on", S(fd, "qr_proveedor") || "Vendis", S(fd, "qr_url_base") || null, S(fd, "qr_api_key"), S(fd, "qr_webhook_secret") || "cambia-este-secreto"]);
  await audit(s.nombre, "CONFIG_QR", "actualizada"); revalidatePath("/admin/api");
}

/* ---------- QR ---------- */
async function autorizarSocio(socioId: number, token?: string) {
  if (token) { const t = await verify<{ socioId: number }>(token); if (t && t.socioId === socioId) return { cajeroId: null as number | null }; throw new Error("Sesión expirada"); }
  const s = await requireRole(["ADMIN", "GERENTE", "CAJERO"]); return { cajeroId: s.uid };
}
export async function crearQr(socioId: number, periodos: string[], token?: string) {
  try {
    const cfg = await getConfig();
    if (!cfg.qr_activo) return { error: "El cobro por QR no está habilitado" };
    const { cajeroId } = await autorizarSocio(socioId, token);
    const pend = (await q(`SELECT DISTINCT periodo FROM cargos WHERE socio_id=$1 AND estado='PENDIENTE' ORDER BY periodo`, [socioId])).map((r) => r.periodo.trim());
    const sel = [...periodos].sort();
    if (!sel.length || sel.some((p, i) => p !== pend[i])) return { error: "Seleccione periodos desde el más antiguo, sin saltar" };
    const monto = (await q1(`SELECT SUM(total) t FROM cargos WHERE socio_id=$1 AND estado='PENDIENTE' AND periodo=ANY($2)`, [socioId, sel]))!.t as number;
    const ref = `AGUA-${socioId}-${Date.now()}`;
    const { payload, dataUrl } = await generarQr({ referencia: ref, monto, glosa: `Agua potable ${sel[0]}..${sel[sel.length - 1]}` });
    const tx_ = await q1(`INSERT INTO qr_transacciones (socio_id,periodos,monto,referencia,qr_payload,cajero_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [socioId, sel, monto, ref, payload, cajeroId]);
    return { id: tx_!.id as number, dataUrl, monto, sandbox: cfg.qr_sandbox };
  } catch (e: any) { return { error: e.message as string }; }
}
export async function simularQr(id: number) {
  const cfg = await getConfig();
  if (!cfg.qr_sandbox) return { error: "Solo disponible en modo sandbox" };
  try { return { pagoId: await confirmarQr(id) }; } catch (e: any) { return { error: e.message as string }; }
}

/* ---------- Estado de cuenta público ---------- */
export async function verificarSocio(_: unknown, fd: FormData) {
  const ci = S(fd, "ci").replace(/\s/g, ""), cel = S(fd, "celular").replace(/\D/g, "");
  const so = await q1(`SELECT id FROM socios WHERE replace(ci,' ','')=$1 AND regexp_replace(coalesce(celular,''),'\\D','','g')=$2 AND activo LIMIT 1`, [ci, cel]);
  if (!so || cel.length < 6) return { error: "No encontramos un socio con esos datos" };
  redirect(`/estado-cuenta/ver?t=${await sign({ socioId: so.id }, "30m")}`);
}
