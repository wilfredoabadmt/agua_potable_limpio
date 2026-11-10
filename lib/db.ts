import { Pool, types, PoolClient } from "pg";
types.setTypeParser(1700, (v) => parseFloat(v)); // numeric -> number
types.setTypeParser(20, (v) => parseInt(v, 10));  // bigint/count -> number

const g = globalThis as unknown as { pool?: Pool };
export const pool = g.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") g.pool = pool;

export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[];
}
export async function q1<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return (await q<T>(sql, params))[0] ?? null;
}
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query("BEGIN"); const r = await fn(c); await c.query("COMMIT"); return r; }
  catch (e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
}
