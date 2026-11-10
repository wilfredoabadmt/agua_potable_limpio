export type Tramo = { desde: number; hasta: number | null; precio: number };
export type Tarifa = { tipo: "FIJA" | "CONSUMO"; cargo_minimo: number; m3_minimos: number; tramos: Tramo[] };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** FIJA: monto único sin lectura. CONSUMO: cargo mínimo (incluye m3_minimos) + m3 adicionales por tramos progresivos. */
export function calcular(t: Tarifa, consumo: number) {
  const base = Number(t.cargo_minimo);
  if (t.tipo === "FIJA") return { base, exceso: 0, total: r2(base) };
  let exceso = 0;
  for (const tr of t.tramos) {
    const desde = Math.max(tr.desde, t.m3_minimos + 1);
    const hasta = tr.hasta ?? Infinity;
    exceso += Math.max(0, Math.min(consumo, hasta) - desde + 1) * Number(tr.precio);
  }
  return { base, exceso: r2(exceso), total: r2(base + exceso) };
}
export function describir(t: Tarifa) {
  if (t.tipo === "FIJA") return `Cargo fijo ${t.cargo_minimo} Bs/mes (sin lectura)`;
  const partes = [`${t.cargo_minimo} Bs hasta ${t.m3_minimos} m³`];
  for (const tr of t.tramos) partes.push(`${tr.hasta ? `${tr.desde}–${tr.hasta}` : `>${tr.desde - 1}`} m³: ${tr.precio} Bs/m³`);
  return partes.join(" · ");
}
