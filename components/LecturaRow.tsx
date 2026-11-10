"use client";
import { useState, useTransition } from "react";
import { registrarLectura, modificarLectura, eliminarLectura } from "@/app/actions";
import { calcular, Tarifa } from "@/lib/tarifa";
import { bs } from "@/lib/format";
import { Check, Trash2, Edit2, AlertCircle } from "lucide-react";

type M = { id: number; numero: string; socio: string; direccion: string; zona: string; anterior: number; actual: number | null; pagado: boolean; tarifa: Tarifa };
type Role = "ADMIN" | "GERENTE" | "LECTOR" | "CAJERO" | "SOCIO";

export default function LecturaRow({ m, periodo, rol }: { m: M; periodo: string; rol: Role }) {
  const [val, setVal] = useState(m.actual?.toString() ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [saved, setSaved] = useState(m.actual !== null);
  const [pending, start] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [justificacion, setJustificacion] = useState("");
  const [delConfirm, setDelConfirm] = useState(false);
  const n = val === "" ? null : Number(val);
  const consumo = n !== null && n >= m.anterior ? n - m.anterior : null;
  const imp = consumo !== null ? calcular(m.tarifa, consumo).total : null;

  const guardar = async () => {
    if (n === null || m.pagado) return;
    start(async () => {
      const r = await registrarLectura(m.id, periodo, n);
      setMsg({ ok: r.ok, t: r.msg });
      if (r.ok) { setSaved(true); setEditMode(false); setVal(n.toString()); }
    });
  };

  const guardarModificacion = async () => {
    if (!justificacion || justificacion.trim().length < 3) {
      setMsg({ ok: false, t: "Justificación requerida (mínimo 3 caracteres)" });
      return;
    }
    start(async () => {
      const r = await modificarLectura(m.id, periodo, n ?? m.actual!, justificacion.trim());
      setMsg({ ok: r.ok, t: r.msg });
      if (r.ok) { setSaved(true); setEditMode(false); setJustificacion(""); setVal(n?.toString() ?? m.actual!.toString()); }
    });
  };

  const eliminar = async () => {
    setDelConfirm(false);
    const r = await eliminarLectura(m.id, periodo);
    setMsg({ ok: r.ok, t: r.msg });
    if (r.ok) { setSaved(false); setVal(""); }
  };

  const puedeModificar = rol === "ADMIN" || rol === "GERENTE" || (rol === "LECTOR" && !m.actual);
  const puedeEliminar = rol === "ADMIN" || rol === "GERENTE";

  return (
    <tr className="hover:bg-ink-50/70">
      <td className="td font-mono text-xs">{m.numero}</td>
      <td className="td"><div className="font-semibold">{m.socio}</div><div className="text-xs text-ink-500">{m.direccion} · {m.zona}</div></td>
      <td className="td text-right tabular-nums text-ink-500">{m.anterior}</td>
      <td className="td w-48">
        {editMode && !m.pagado ? (
          <div className="flex flex-col gap-2">
            <input type="number" min={m.anterior} value={val} onChange={(e) => setVal(e.target.value)} className="input text-right tabular-nums" placeholder="Lectura" />
            <input type="text" value={justificacion} onChange={(e) => setJustificacion(e.target.value)} placeholder="Justificación (requerida)" className="input text-xs" />
            <div className="flex gap-2">
              <button onClick={guardarModificacion} disabled={pending} className="btn-primary text-xs px-3 py-1.5">Guardar</button>
              <button onClick={() => setEditMode(false)} className="btn-ghost text-xs px-3 py-1.5">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="number" min={m.anterior} value={val} disabled={m.pagado || !puedeModificar} onChange={(e) => { setVal(e.target.value); setSaved(false); setMsg(null); }} onBlur={guardar} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} placeholder="Lectura" className={`input text-right tabular-nums ${!puedeModificar ? "opacity-50 cursor-not-allowed" : ""}`} />
            {!saved && !m.pagado && puedeModificar && <button onClick={guardar} disabled={pending} className="btn-primary text-xs px-3">Registrar</button>}
            {saved && !m.pagado && rol === "LECTOR" && <button onClick={() => setEditMode(true)} disabled={pending} className="btn-ghost text-xs px-3 py-1.5"><Edit2 className="h-3 w-3" /> Modificar</button>}
            {saved && !m.pagado && puedeEliminar && !delConfirm && <button onClick={() => setDelConfirm(true)} disabled={pending} className="btn-ghost text-xs px-3 py-1.5 text-ink-600"><Trash2 className="h-3 w-3" /> Eliminar</button>}
            {saved && !m.pagado && delConfirm && <button onClick={eliminar} disabled={pending} className="btn-ghost text-xs px-3 py-1.5 text-red-600">¿Eliminar?</button>}
          </div>
        )}
      </td>
      <td className="td text-right tabular-nums font-semibold">{consumo !== null ? `${consumo} m³` : "—"}</td>
      <td className="td text-right tabular-nums">{imp !== null ? bs(imp) : "—"}</td>
      <td className="td text-right">
        {m.pagado ? <span className="badge-ok">Cobrado</span> : pending ? <span className="badge-info">Guardando…</span>
          : msg && !msg.ok ? <span className="badge-bad" title={msg.t}>{msg.t}</span>
          : saved ? <span className="badge-ok inline-flex items-center gap-1"><Check className="h-3 w-3" />Registrada</span> : <span className="badge-warn">Pendiente</span>}
      </td>
    </tr>
  );
}
