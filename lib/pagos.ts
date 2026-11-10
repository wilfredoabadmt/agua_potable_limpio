import { PoolClient } from "pg";
import { tx } from "./db";

/** Cobra los cargos indicados por ID. Regla FIFO validada en servidor. */
export async function crearPago(a: {
  socioId: number; cargoIds: number[]; metodo: "EFECTIVO" | "QR" | "TRANSFERENCIA";
  cajeroId: number | null; qrTxId?: number; usuario?: string;
}, c?: PoolClient) {
  if (!Number.isInteger(a.socioId) || a.socioId <= 0) throw new Error("Socio inválido");
  if (!a.cargoIds.length || a.cargoIds.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error("Seleccione al menos un medidor");
  if (a.cajeroId !== null && (!Number.isInteger(a.cajeroId) || a.cajeroId <= 0)) throw new Error("Cajero inválido");
  const run = async (cx: PoolClient) => {
    // Validar FIFO: obtener todos los cargos pendientes del socio ordenados por periodo
    const pend = (await cx.query(
      `SELECT id, periodo, medidor_id FROM cargos WHERE socio_id=$1 AND estado='PENDIENTE' ORDER BY periodo, medidor_id`, [a.socioId])).rows;
    if (!pend.length) throw new Error("No hay cargos pendientes");
    // Los IDs seleccionados deben ser un prefijo de los pendientes (FIFO por periodo)
    const selSet = new Set(a.cargoIds);
    const pendIds = pend.map((r) => r.id);
    const expected = pendIds.filter((id) => selSet.has(id));
    if (expected.length !== a.cargoIds.length) throw new Error("Selección inválida: debe pagar desde el periodo más antiguo, sin saltar");
    // Verificar que no se saltó un periodo: todos los cargos de periodos anteriores al último seleccionado deben estar incluidos
    const ultimoPeriodo = pend[pend.length - 1].periodo;
    const selPeriodos = pend.filter((r) => selSet.has(r.id)).map((r) => r.periodo);
    const maxSelPeriodo = selPeriodos.reduce((a, b) => (a > b ? a : b), selPeriodos[0]);
    const pendAntes = pend.filter((r) => r.periodo <= maxSelPeriodo);
    const idsAntes = pendAntes.map((r) => r.id);
    if (!idsAntes.every((id) => selSet.has(id))) throw new Error("Debe pagar todos los cargos del periodo más antiguo antes de avanzar");
    const tot = (await cx.query(
      `SELECT COALESCE(SUM(total),0) t FROM cargos WHERE id = ANY($1)`, [a.cargoIds])).rows[0].t;
    const pago = (await cx.query(
      `INSERT INTO pagos (socio_id,total,metodo,cajero_id,qr_tx_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [a.socioId, tot, a.metodo, a.cajeroId, a.qrTxId ?? null])).rows[0].id as number;
    await cx.query(`UPDATE cargos SET estado='PAGADO', pago_id=$1 WHERE id = ANY($2)`, [pago, a.cargoIds]);
    await cx.query(`INSERT INTO auditoria (usuario,accion,detalle) VALUES ($1,'PAGO',$2)`, [a.usuario ?? "sistema", `Pago #${pago} socio ${a.socioId} cargos ${a.cargoIds.join(",")} (${a.metodo})`]);
    return pago;
  };
  return c ? run(c) : tx(run);
}

/** Confirma una transacción QR (webhook o sandbox). Idempotente. */
export async function confirmarQr(txId: number) {
  return tx(async (c) => {
    const t = (await c.query(`SELECT * FROM qr_transacciones WHERE id=$1 FOR UPDATE`, [txId])).rows[0];
    if (!t) throw new Error("Transacción no existe");
    if (t.estado === "PAGADO") return t.pago_id as number;
    // Buscar cargo IDs pendientes para esos periodos y socio
    const rows = await c.query(`SELECT id FROM cargos WHERE socio_id=$1 AND estado='PENDIENTE' AND periodo = ANY($2)`, [t.socio_id, t.periodos]);
    const cargoIds = rows.rows.map((r) => r.id);
    if (!cargoIds.length) throw new Error("No hay cargos pendientes para esta transacción QR");
    const pagoId = await crearPago({ socioId: t.socio_id, cargoIds, metodo: "QR", cajeroId: t.cajero_id, qrTxId: t.id, usuario: "QR" }, c);
    await c.query(`UPDATE qr_transacciones SET estado='PAGADO', pago_id=$1 WHERE id=$2`, [pagoId, txId]);
    return pagoId;
  });
}
