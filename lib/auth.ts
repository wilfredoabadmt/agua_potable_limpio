import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Rol = "ADMIN" | "GERENTE" | "LECTOR" | "CAJERO" | "SOCIO";
export type Session = { uid: number; nombre: string; rol: Rol; zonaId: number | null; socioId: number | null };
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

export async function sign(payload: object, exp = "10h") {
  return new SignJWT({ ...payload }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(exp).sign(secret());
}
export async function verify<T = any>(token?: string | null): Promise<T | null> {
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload as T; } catch { return null; }
}
export async function createSession(s: Session) {
  cookies().set("sess", await sign(s), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 36000, secure: process.env.COOKIE_SECURE === "true",
  });
}
export const getSession = () => verify<Session>(cookies().get("sess")?.value);
export async function requireRole(roles: Rol[] = ["ADMIN", "GERENTE", "LECTOR", "CAJERO", "SOCIO"]) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!roles.includes(s.rol)) redirect(s.rol === "SOCIO" ? "/mi-cuenta" : "/dashboard");
  return s;
}
