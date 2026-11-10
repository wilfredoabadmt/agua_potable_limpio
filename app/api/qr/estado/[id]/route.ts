import { NextResponse } from "next/server";
import { q1 } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const t = await q1("SELECT estado, pago_id FROM qr_transacciones WHERE id=$1", [Number(params.id)]);
  return NextResponse.json({ estado: t?.estado ?? "NO_EXISTE", pagoId: t?.pago_id ?? null });
}
