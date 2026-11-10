"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { procesarPago, crearQr, simularQr } from "@/app/actions";
import { bs, periodoLabel } from "@/lib/format";
import { Check, QrCode, Banknote, ChevronDown } from "lucide-react";

export type Item = { cargoId: number; medidor: string; consumo: number; total: number; tipo: string };
export type Periodo = { periodo: string; total: number; items: Item[] };

export default function CobroForm({ socioId, periodos, qrActivo, token }: { socioId: number; periodos: Periodo[]; qrActivo: boolean; token?: string }) {
  const router = useRouter();
  const [metodo, setMetodo] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [recibido, setRecibido] = useState("");
  const [err, setErr] = useState("");
  const [qr, setQr] = useState<{ id: number; dataUrl: string; monto: number; sandbox: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [openPeriod, setOpenPeriod] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const completo = (p: Periodo) => p.items.every((it) => selected.has(`${p.periodo}|${it.medidor}`));
  const ultimoCompletoIdx = periodos.findIndex((p) => !completo(p));
  const puedeSeleccionar = (pIdx: number) => ultimoCompletoIdx === -1 || pIdx <= ultimoCompletoIdx;

  const toggleItem = (pIdx: number, item: Item) => {
    const p = periodos[pIdx];
    if (!puedeSeleccionar(pIdx)) return;
    const key = `${p.periodo}|${item.medidor}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selItems: Item[] = [];
  let total = 0;
  periodos.forEach((p) => {
    p.items.forEach((it) => {
      if (selected.has(`${p.periodo}|${it.medidor}`)) { selItems.push(it); total += it.total; }
    });
  });

  const cargoIds = selItems.map((it) => it.cargoId);
  const cambio = recibido ? Number(recibido) - total : null;
  const staff = !token;
  const destino = (id: number) => (staff ? `/imprimir/recibo/${id}` : `/imprimir/recibo/${id}?t=${token}`);

  useEffect(() => {
    if (!qr) return;
    const t = setInterval(async () => {
      const r = await (await fetch(`/api/qr/estado/${qr.id}`, { cache: "no-store" })).json();
      if (r.estado === "PAGADO") router.push(destino(r.pagoId));
    }, 2500);
    return () => clearInterval(t);
  }, [qr]);

  const pagar = () => start(async () => {
    setErr("");
    if (cargoIds.length === 0) { setErr("Seleccione al menos un medidor"); return; }
    const r = await procesarPago(socioId, cargoIds, metodo);
    if ("error" in r && r.error) setErr(r.error); else if ("pagoId" in r) router.push(`/imprimir/recibo/${r.pagoId}`);
  });
  const generarQR = () => start(async () => {
    setErr("");
    if (cargoIds.length === 0) { setErr("Seleccione al menos un medidor"); return; }
    const qPeriodos = Array.from(new Set(periodos.filter((p) => p.items.some((it) => selected.has(`${p.periodo}|${it.medidor}`))).map((p) => p.periodo)));
    const r = await crearQr(socioId, qPeriodos, token);
    if ("error" in r && r.error) setErr(r.error); else if ("id" in r) setQr(r as any);
  });

  const years = Array.from(new Set(periodos.map((p) => p.periodo.slice(0, 4))));
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        {years.map((y) => (
          <div key={y} className="card p-5">
            <div className="mb-4 flex justify-between"><h3 className="font-semibold">Año {y}</h3><span className="text-sm text-ink-500">Total: <b>{bs(periodos.filter((p) => p.periodo.startsWith(y)).reduce((a, p) => a + p.total, 0))}</b></span></div>
            <div className="space-y-3">
              {periodos.filter((p) => p.periodo.startsWith(y)).map((p, pIdx) => {
                const isOpen = openPeriod === p.periodo;
                const allSel = completo(p);
                const someSel = p.items.some((it) => selected.has(`${p.periodo}|${it.medidor}`));
                return (
                  <div key={p.periodo} className="card border rounded-xl overflow-hidden">
                    <button onClick={() => setOpenPeriod(isOpen ? null : p.periodo)} className="w-full flex items-center justify-between px-4 py-3 bg-white/50 hover:bg-white/70 transition">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${allSel ? "text-brand-700" : "text-ink-700"}`}>{periodoLabel(p.periodo)}</span>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md ${allSel ? "bg-brand-600 text-white" : "ring-1 ring-ink-300"}`}>
                          {allSel ? <Check className="h-3 w-3" /> : someSel ? <span className="text-xs text-amber-600">·</span> : null}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-right w-24">{bs(p.total)}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3">
                        <p className="text-xs text-ink-500 mb-2">Seleccione medidor(es) para cobrar:</p>
                        <div className="space-y-2">
                          {p.items.map((it) => (
                            <button key={it.cargoId} onClick={() => toggleItem(pIdx, it)} disabled={!puedeSeleccionar(pIdx)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition ${
                                selected.has(`${p.periodo}|${it.medidor}`)
                                  ? "bg-brand-50 border-brand-300"
                                  : "bg-white border-ink-200 hover:border-brand-300"
                              }`}>
                              <div className="flex items-center gap-3">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${selected.has(`${p.periodo}|${it.medidor}`) ? "bg-brand-600 text-white border-brand-600" : "text-ink-400 border-ink-300"}`}>
                                  {selected.has(`${p.periodo}|${it.medidor}`) ? "✓" : it.medidor.slice(-2)}
                                </span>
                                <div>
                                  <div className="text-sm font-medium">{it.medidor}{it.tipo === "CONSUMO" ? ` · ${it.consumo} m³` : " · fijo"}</div>
                                  <div className="text-xs text-ink-400">Tipo: {it.tipo}</div>
                                </div>
                              </div>
                              <span className="font-bold">{bs(it.total)}</span>
                            </button>))}
                        </div>
                        {!puedeSeleccionar(pIdx) && <p className="text-xs text-rose-600 mt-2">Complete los periodos anteriores primero (FIFO).</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {periodos.length === 0 && <div className="card p-10 text-center text-emerald-600">Este socio no tiene deudas pendientes.</div>}
        {periodos.length > 0 && <p className="text-xs text-ink-500">Regla FIFO: pague los periodos desde el más antiguo. Puede seleccionar medidores individuales dentro de cada periodo.</p>}
      </div>
      <div className="lg:col-span-2">
        <div className="card sticky top-6 overflow-hidden">
          <div className="border-b border-ink-100 bg-ink-50 px-5 py-3 font-semibold">Detalle de pago</div>
          <div className="space-y-2 p-5 text-sm">
            {selItems.length === 0 && <p className="text-ink-500">Seleccione los medidores que desea cobrar.</p>}
            {selItems.map((it) => <div key={`${it.cargoId}`} className="flex justify-between text-xs"><span>{it.medidor}{it.tipo === "CONSUMO" ? ` · ${it.consumo} m³` : " · fijo"}</span><span className="tabular-nums">{bs(it.total)}</span></div>)}
            <div className="flex items-end justify-between border-t border-ink-100 pt-3"><span className="font-semibold">Total a pagar</span><span className="text-2xl font-bold text-brand-700">{bs(total)}</span></div>
          </div>
          {!qr ? (
            <div className="space-y-3 border-t border-ink-100 p-5">
              {staff && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Método</label><select value={metodo} onChange={(e) => setMetodo(e.target.value as any)} className="input"><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option></select></div>
                  <div><label className="label">Monto recibido</label><input type="number" step="0.01" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder={total.toFixed(2)} className="input" /></div>
                </div>
                {cambio !== null && cambio >= 0 && metodo === "EFECTIVO" && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Cambio a devolver: <b>{bs(cambio)}</b></div>}
                <button disabled={cargoIds.length === 0 || pending} onClick={pagar} className="btn-dark w-full"><Banknote className="h-4 w-4" />Procesar pago</button>
              </>)}
              {qrActivo && <button disabled={cargoIds.length === 0 || pending} onClick={generarQR} className={staff ? "btn-ghost w-full" : "btn-primary w-full"}><QrCode className="h-4 w-4" />Pagar con QR</button>}
              {err && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
            </div>
          ) : (
            <div className="space-y-3 border-t border-ink-100 p-5 text-center">
              <img src={qr.dataUrl} alt="QR de pago" className="mx-auto h-56 w-56 rounded-xl ring-1 ring-ink-100" />
              <p className="text-sm text-ink-500">Escanee con la app de su banco para pagar <b className="text-ink-900">{bs(qr.monto)}</b>. Esta pantalla se actualizará al confirmarse.</p>
              <div className="flex items-center justify-center gap-2 text-xs text-brand-700"><span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />Esperando confirmación…</div>
              {qr.sandbox && <button onClick={() => start(async () => { const r = await simularQr(qr.id); if ("pagoId" in r && r.pagoId) router.push(destino(r.pagoId)); })} className="btn-ghost w-full">Simular pago (sandbox)</button>}
              <button onClick={() => setQr(null)} className="text-xs text-ink-500 underline">Cancelar QR</button>
            </div>)}
        </div>
      </div>
    </div>
  );
}
