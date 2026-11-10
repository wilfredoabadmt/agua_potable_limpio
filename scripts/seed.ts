import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { calcular } from "../lib/tarifa";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = (s: string, p: any[] = []) => pool.query(s, p).then((r) => r.rows);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

(async () => {
  await q(`TRUNCATE auditoria,qr_transacciones,proformas,cargos,pagos,lecturas,medidores,tarifarios,usuarios,socios,zonas RESTART IDENTITY CASCADE`);
  await q(`UPDATE config SET nombre='Comité de Agua Potable San Roque', qr_activo=true, qr_sandbox=true WHERE id=1`);
  for (const z of [["Barrio Central", "Casco urbano"], ["San Roque", "Zona norte"], ["Villa Fátima", "Zona sur"], ["Los Pinos", "Urbanización nueva"]]) await q(`INSERT INTO zonas (nombre,descripcion) VALUES ($1,$2)`, z);
  const tf = [
    ["Tarifa fija única", "FIJA", 15, 0, []],
    ["Domiciliario con lectura", "CONSUMO", 15, 9, [{ desde: 10, hasta: 15, precio: 2 }, { desde: 16, hasta: null, precio: 3 }]],
    ["Comercial con lectura", "CONSUMO", 25, 12, [{ desde: 13, hasta: 20, precio: 3 }, { desde: 21, hasta: null, precio: 4.5 }]],
  ];
  for (const t of tf) await q(`INSERT INTO tarifarios (nombre,tipo,cargo_minimo,m3_minimos,tramos) VALUES ($1,$2,$3,$4,$5)`, [t[0], t[1], t[2], t[3], JSON.stringify(t[4])]);
  const tarifas = await q(`SELECT * FROM tarifarios ORDER BY id`);

  const nombres = ["Elizabeth", "Pedro", "Edgar Rufino", "Jorven Brandon", "Josué", "María Elena", "Carlos", "Rosmery", "Juan Carlos", "Ana Lucía", "Freddy", "Norma", "Luis Alberto", "Gladys", "Marcelo", "Sandra", "Wilson", "Patricia", "Óscar", "Mirian", "Gonzalo", "Verónica", "Ramiro", "Teresa"];
  const apell = ["Alfonso Ponce", "Acevedo Campos", "Acevedo Arancibia", "Echevarría Santiago", "Mamani Quispe", "Flores Vargas", "Choque Condori", "Rojas Medina", "Vaca Suárez", "Colque Mendoza", "Gutiérrez Román", "Torrez Ayala", "Soliz Cruz", "Pinto Ortega", "Cussi Layme", "Cabrera Lima", "Ramos Tapia", "Álvarez Paz", "Mendoza Rivera", "Guzmán Aliaga", "Burgos Salazar", "Ortiz Cáceres", "Fernández Roca", "Camacho Peña"];
  const calles = ["Av. Arturo Durán", "Calle Santa Isabel", "Jr. Las Almendras", "Av. Panamericana", "Calle Bolívar", "Calle Los Cedros"];
  const hoy = new Date(); const per = (off: number) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() + off, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const periodos = [per(-5), per(-4), per(-3), per(-2), per(-1), per(0)];

  const hash = await bcrypt.hash("admin123", 10);
  const socios: number[] = [];
  for (let i = 0; i < nombres.length; i++) {
    const s = await q(`INSERT INTO socios (nombres,apellidos,ci,zona_id,direccion,numero,celular,tipo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [nombres[i], apell[i], String(4000000 + ri(100000, 3999999)), (i % 4) + 1, calles[i % calles.length], String(ri(1, 240)), `7${ri(1000000, 9999999)}`, i === 7 ? "JURIDICA" : "NATURAL"]);
    socios.push(s[0].id);
  }
  // Socio demo conocido
  await q(`UPDATE socios SET ci='7523718', celular='70012345' WHERE id=$1`, [socios[3]]);
  const usuarios = [["Administrador General", "admin@agua.bo", "ADMIN", null, null], ["Gerente Operaciones", "gerente@agua.bo", "GERENTE", null, null], ["Cajera Principal", "cajero@agua.bo", "CAJERO", null, null], ["Lector Zona Norte", "lector@agua.bo", "LECTOR", 2, null], ["Josué Echevarría", "socio@agua.bo", "SOCIO", null, socios[3]]];
  for (const u of usuarios) await q(`INSERT INTO usuarios (nombre,email,password,rol,zona_id,socio_id) VALUES ($1,$2,$3,$4,$5,$6)`, [u[0], u[1], hash, u[2], u[3], u[4]]);

  // Medidores: la mayoría 1, algunos 2–3 (socio con varios medidores)
  let n = 1000; const meds: { id: number; socio: number; t: any; lect: number }[] = [];
  for (let i = 0; i < socios.length; i++) {
    const cant = i % 6 === 3 ? 3 : i % 5 === 1 ? 2 : 1;
    for (let k = 0; k < cant; k++) {
      const t = i === 7 || (k === 1 && i % 5 === 1 && i > 6) ? tarifas[2] : i % 9 === 4 ? tarifas[0] : tarifas[1];
      const ini = ri(100, 900);
      const m = await q(`INSERT INTO medidores (numero,socio_id,tarifario_id,ubicacion,lectura_inicial) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [`M-${++n}`, socios[i], t.id, k === 0 ? "Vivienda principal" : k === 1 ? "Local / tienda" : "Lote 2", ini]);
      meds.push({ id: m[0].id, socio: socios[i], t, lect: ini });
    }
  }
  // Historial: lecturas + cargos; la mayoría paga hasta cierto mes
  const pagadoHasta = new Map<number, number>(); socios.forEach((s, i) => pagadoHasta.set(s, i % 7 === 0 ? 1 : i % 4 === 0 ? 3 : i % 5 === 0 ? 2 : 5));
  const pagos = new Map<string, number>();
  for (let pi = 0; pi < periodos.length; pi++) {
    const p = periodos[pi];
    for (const m of meds) {
      let consumo = 0;
      if (m.t.tipo === "CONSUMO") {
        if (pi === 5 && rnd() < 0.45) continue; // lecturas faltantes del mes actual
        consumo = ri(5, 22); const ant = m.lect; m.lect += consumo;
        await q(`INSERT INTO lecturas (medidor_id,periodo,anterior,actual,consumo,fecha) VALUES ($1,$2,$3,$4,$5,$6)`, [m.id, p, ant, m.lect, consumo, new Date(`${p}-25T10:00:00`)]);
      }
      const c = calcular({ tipo: m.t.tipo, cargo_minimo: Number(m.t.cargo_minimo), m3_minimos: m.t.m3_minimos, tramos: m.t.tramos }, consumo);
      const pagar = pi < (pagadoHasta.get(m.socio) ?? 0) + 0 && pi <= 4;
      let pagoId: number | null = null;
      if (pagar) {
        const key = `${m.socio}-${p}`;
        if (!pagos.has(key)) { const d = new Date(`${periodos[pi + 1] ?? p}-0${ri(1, 6)}T${String(ri(8, 17)).padStart(2, "0")}:${ri(10, 50)}:00`); const r = await q(`INSERT INTO pagos (socio_id,total,metodo,cajero_id,fecha) VALUES ($1,0,$2,3,$3) RETURNING id`, [m.socio, rnd() < 0.25 ? "QR" : "EFECTIVO", d]); pagos.set(key, r[0].id); }
        pagoId = pagos.get(key)!;
      }
      await q(`INSERT INTO cargos (medidor_id,socio_id,periodo,consumo,base,exceso,total,estado,pago_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [m.id, m.socio, p, consumo, c.base, c.exceso, c.total, pagoId ? "PAGADO" : "PENDIENTE", pagoId]);
    }
  }
  await q(`UPDATE pagos p SET total = (SELECT COALESCE(sum(total),0) FROM cargos c WHERE c.pago_id=p.id)`);
  await q(`DELETE FROM pagos WHERE total=0`);
  await q(`UPDATE pagos SET anulado=true, motivo_anulacion='Error de digitación del monto' WHERE id=(SELECT min(id) FROM pagos)`);
  await q(`UPDATE cargos SET estado='PENDIENTE', pago_id=NULL WHERE pago_id=(SELECT id FROM pagos WHERE anulado)`);
  await q(`INSERT INTO auditoria (usuario,accion,detalle) VALUES ('Administrador General','SEED','Datos de demostración cargados')`);
  console.log(`✔ Datos de demostración: ${socios.length} socios, ${meds.length} medidores`);
  await pool.end();
})();
