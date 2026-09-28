import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const env = await readFile(".env.local", "utf8").catch(() => "");
const databaseUrl = process.env.DATABASE_URL ?? env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, "") ?? "postgresql://ovdp:ovdp@localhost:5432/ovdp";
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("CREATE TABLE IF NOT EXISTS app_migrations (version text PRIMARY KEY)");

  const files = (await readdir("supabase/migrations")).filter((file) => file.endsWith(".sql")).sort();
  const { rows: schema } = await client.query(`
    SELECT to_regclass('public.bonds') IS NOT NULL
      AND to_regclass('public.coupons') IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bonds' AND column_name = 'tax_rate')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bonds' AND column_name = 'fixed_coupon' AND data_type = 'numeric') AS current
  `);
  const { rows: applied } = await client.query("SELECT version FROM app_migrations");
  const appliedSet = new Set(applied.map(({ version }) => version));

  if (schema[0].current && appliedSet.size === 0) {
    for (const file of files) await client.query("INSERT INTO app_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
    console.log("Database schema is current; recorded existing migrations.");
  } else {
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      await client.query("BEGIN");
      try {
        await client.query(await readFile(`supabase/migrations/${file}`, "utf8"));
        await client.query("INSERT INTO app_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  }
} finally {
  await client.end();
}
