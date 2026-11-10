import { q1 } from "./db";
export type Config = {
  nombre: string; logo_url: string | null; moneda: string; vencimiento_dia: number;
  qr_activo: boolean; qr_sandbox: boolean; qr_proveedor: string; qr_url_base: string | null;
  qr_api_key: string | null; qr_webhook_secret: string;
};
export const getConfig = async () => (await q1<Config>("SELECT * FROM config WHERE id=1"))!;
