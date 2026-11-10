import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Sistema de Agua Potable", description: "Lectura, cobro y comprobantes del servicio de agua potable" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
