import { readFileSync } from "fs";
import { Pool } from "pg";
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(readFileSync("db/schema.sql", "utf8"));
  console.log("✔ Esquema creado/actualizado");
  await pool.end();
})();
