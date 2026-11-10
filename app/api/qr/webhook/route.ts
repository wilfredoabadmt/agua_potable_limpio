import { NextRequest, NextResponse } from "next/server";
import { q1 } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { confirmarQr } from "@/lib/pagos";

/** Notificación de pago de la pasarela. Header: x-api-key = secreto del webhook. Body: { referencia, estado } */
export async function POST(req: NextRequest) {
  const cfg = await getConfig();
  if (req.headers.get("x-api-key") !== cfg.qr_webhook_secret) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const t = await q1("SELECT id FROM qr_transacciones WHERE referencia=$1", [b.referencia]);
  if (!t) return NextResponse.json({ error: "referencia desconocida" }, { status: 404 });
  if (String(b.estado ?? "PAGADO").toUpperCase() !== "PAGADO") return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: true, pagoId: await confirmarQr(t.id) });
}
