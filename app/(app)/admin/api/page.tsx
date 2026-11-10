import { requireRole } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { q } from "@/lib/db";
import { guardarQr } from "@/app/actions";
import { bs, fechaHora } from "@/lib/format";
import { PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function ApiAdmin() {
  await requireRole(["ADMIN"]);
  const [cfg, txs] = await Promise.all([getConfig(), q("SELECT * FROM qr_transacciones ORDER BY id DESC LIMIT 8")]);
  return (
    <>
      <PageHeader title="Pasarela de pago QR" sub="Administrador de API para el cobro por QR (proveedor Vendis)" />
      <div className="grid gap-6 xl:grid-cols-2">
        <form action={guardarQr} className="card space-y-4 p-6">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Credenciales</h2><span className={cfg.qr_activo ? "badge-ok" : "badge-warn"}>{cfg.qr_activo ? "Habilitado" : "Deshabilitado"}</span></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="qr_activo" defaultChecked={cfg.qr_activo} />Habilitar cobro por QR (estado de cuenta del socio y caja)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="qr_sandbox" defaultChecked={cfg.qr_sandbox} />Modo sandbox (QR simulado, sin llamar al proveedor)</label>
          <div><label className="label">Proveedor</label><input name="qr_proveedor" defaultValue={cfg.qr_proveedor} className="input" /></div>
          <div><label className="label">URL base de la API</label><input name="qr_url_base" defaultValue={cfg.qr_url_base ?? ""} placeholder="https://api.proveedor.com/v1" className="input" /></div>
          <div><label className="label">API key {cfg.qr_api_key && <span className="normal-case text-emerald-600">· guardada</span>}</label><input name="qr_api_key" type="password" placeholder="Dejar vacío para conservar" className="input" /></div>
          <div><label className="label">Secreto del webhook</label><input name="qr_webhook_secret" defaultValue={cfg.qr_webhook_secret} className="input font-mono" /></div>
          <button className="btn-primary w-full">Guardar</button>
        </form>
        <div className="space-y-6">
          <div className="card p-6"><h2 className="mb-2 font-semibold">Webhook de confirmación</h2>
            <p className="text-sm text-ink-500">Configure esta URL en el panel del proveedor. Enviar <code>POST</code> con el header <code>x-api-key</code> igual al secreto.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs text-brand-100">{`POST /api/qr/webhook\nx-api-key: ${cfg.qr_webhook_secret}\n\n{ "referencia": "AGUA-12-1731000000000", "estado": "PAGADO" }`}</pre></div>
          <div className="card overflow-hidden"><div className="p-6 pb-2 font-semibold">Transacciones QR recientes</div>
            <table className="w-full"><tbody className="divide-y divide-ink-100">{txs.map((t) => <tr key={t.id}><td className="td font-mono text-xs">{t.referencia}</td><td className="td text-xs text-ink-500">{fechaHora(t.creado)}</td><td className="td text-right font-semibold">{bs(t.monto)}</td><td className="td"><span className={t.estado === "PAGADO" ? "badge-ok" : "badge-warn"}>{t.estado}</span></td></tr>)}
              {txs.length === 0 && <tr><td className="td text-ink-500">Sin transacciones todavía.</td></tr>}</tbody></table></div>
        </div>
      </div>
    </>
  );
}
