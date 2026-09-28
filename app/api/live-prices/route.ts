import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";
const ttl = 3 * 60 * 60 * 1000;

async function fetchLivePrices() {
  const init = await fetch("https://next.privat24.ua/api/p24/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(20_000),
  });
  if (!init.ok) throw new Error(`Privat24 init failed (${init.status})`);
  const initData = await init.json();
  const xref = initData?.data?.xref;
  const cookie = init.headers.get("set-cookie")?.split(";", 1)[0];
  if (!xref || !cookie) throw new Error("Privat24 init response is missing xref or cookie");

  const response = await fetch("https://next.privat24.ua/api/p24/pub/bonds", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "bargaining", xref, _: Date.now() }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Privat24 live prices failed (${response.status})`);
  const data = await response.json();
  if (data?.status !== "success" || !Array.isArray(data.data)) throw new Error("Privat24 returned an invalid bond list");
  return data;
}

export async function GET() {
  const ownerId = await requireUserId();
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await getPool().connect();
  let stale: { payload: unknown; fetchedAt: Date } | undefined;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT payload, fetched_at AS \"fetchedAt\" FROM live_prices_cache WHERE id = 1 FOR UPDATE");
    stale = { payload: rows[0].payload, fetchedAt: rows[0].fetchedAt };
    if (Date.now() - new Date(stale.fetchedAt).getTime() < ttl) {
      await client.query("COMMIT");
      return NextResponse.json({ data: stale.payload, fetchedAt: stale.fetchedAt, stale: false });
    }

    const data = await fetchLivePrices();
    const { rows: saved } = await client.query(
      "UPDATE live_prices_cache SET payload = $1, fetched_at = NOW() WHERE id = 1 RETURNING fetched_at AS \"fetchedAt\"",
      [JSON.stringify(data)],
    );
    await client.query("COMMIT");
    return NextResponse.json({ data, fetchedAt: saved[0].fetchedAt, stale: false });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Could not refresh live prices", error);
    if (stale && stale.payload && Object.keys(stale.payload as object).length) {
      return NextResponse.json({ data: stale.payload, fetchedAt: stale.fetchedAt, stale: true });
    }
    return NextResponse.json({ error: "Could not load live bond prices from Privat24." }, { status: 503 });
  } finally {
    client.release();
  }
}
