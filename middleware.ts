import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLICAS = ["/login", "/estado-cuenta", "/imprimir", "/api/qr", "/_next", "/favicon"];
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url));
  if (PUBLICAS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const tok = req.cookies.get("sess")?.value;
  try {
    await jwtVerify(tok ?? "", new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me"));
    return NextResponse.next();
  } catch { return NextResponse.redirect(new URL("/login", req.url)); }
}
export const config = { matcher: ["/((?!.*\\..*).*)"] };
