const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const bs = (n: number | string) => "Bs " + Number(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const periodoLabel = (p: string) => `${MESES[parseInt(p.slice(5, 7), 10) - 1]} ${p.slice(0, 4)}`;
export const periodoActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const periodoAnterior = (p: string) => { const [y, m] = p.split("-").map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const cod = (id: number, n = 5) => String(id).padStart(n, "0");
export const fecha = (d: Date | string) => new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/La_Paz" });
export const fechaHora = (d: Date | string) => new Date(d).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz", hour12: false });
export const nombreCompleto = (s: { nombres: string; apellidos: string }) => `${s.apellidos} ${s.nombres}`;
