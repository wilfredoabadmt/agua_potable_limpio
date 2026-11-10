const { Pool } = require("/app/.next/standalone/node_modules/pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query("SELECT to_regclass('public.config') as exists");
    if (!res.rows[0].exists) {
      console.log("Config table does not exist. Initializing schema...");
      const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, "utf8");
        await pool.query(sql);
        console.log("Schema initialized successfully.");
      }
    } else {
      console.log("Database schema already present.");
    }
  } catch (err) {
    console.error("Auto db init check failed:", err.message);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

