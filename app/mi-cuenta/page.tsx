import { redirect } from "next/navigation";
import { requireRole, sign } from "@/lib/auth";
export default async function MiCuenta() {
  const s = await requireRole(["SOCIO"]);
  if (!s.socioId) redirect("/login");
  redirect(`/estado-cuenta/ver?t=${await sign({ socioId: s.socioId }, "30m")}`);
}
