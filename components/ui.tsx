import { ReactNode } from "react";
export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
export function Stat({ label, value, hint, tone = "brand" }: { label: string; value: ReactNode; hint?: string; tone?: "brand" | "emerald" | "amber" | "rose" }) {
  const t = { brand: "bg-brand-50 text-brand-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700" }[tone];
  return (
    <div className="card p-5">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${t}`}><span className="h-2.5 w-2.5 rounded-full bg-current" /></div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-sm text-ink-500">{label}</div>
      {hint && <div className="mt-1 text-xs text-ink-500/80">{hint}</div>}
    </div>
  );
}
export const Empty = ({ children }: { children: ReactNode }) => <div className="px-4 py-12 text-center text-sm text-ink-500">{children}</div>;
export function Logo({ nombre, url, dark }: { nombre: string; url?: string | null; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {url ? <img src={url} alt="" className="h-10 w-10 rounded-xl object-cover" /> :
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-lg shadow-brand-700/30">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor"><path d="M12 2.5c3.6 4.3 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.4-6.3 6-10.6Z" /></svg>
        </div>}
      <div className={`text-sm font-bold leading-tight ${dark ? "text-white" : ""}`}>{nombre}</div>
    </div>
  );
}
