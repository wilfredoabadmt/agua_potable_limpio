import QRCode from "qrcode";
import { getConfig } from "./config";

/**
 * Adaptador de pasarela QR. El proveedor real (Vendis) se conecta aquí.
 * - Modo sandbox (o sin URL configurada): genera un QR simulado para pruebas.
 * - Modo real: POST {qr_url_base}/qr con Bearer qr_api_key.
 *   ⚠ Ajusta rutas/campos al contrato de la API que entregue Vendis.
 */
export async function generarQr(args: { referencia: string; monto: number; glosa: string }) {
  const cfg = await getConfig();
  let payload = `SIMULADO|${args.referencia}|${args.monto.toFixed(2)}`;
  if (!cfg.qr_sandbox && cfg.qr_url_base && cfg.qr_api_key) {
    const res = await fetch(`${cfg.qr_url_base.replace(/\/$/, "")}/qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.qr_api_key}` },
      body: JSON.stringify({ referencia: args.referencia, monto: args.monto, glosa: args.glosa, moneda: "BOB" }),
    });
    if (!res.ok) throw new Error(`Pasarela QR respondió ${res.status}`);
    const j = await res.json();
    payload = j.qr ?? j.payload ?? j.codigo; // adaptar al campo real
  }
  const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320, color: { dark: "#0b1b2b", light: "#ffffff" } });
  return { payload, dataUrl };
}
