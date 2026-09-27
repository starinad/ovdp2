import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & { bondPool?: Pool };

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  globalForPg.bondPool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return globalForPg.bondPool;
}
