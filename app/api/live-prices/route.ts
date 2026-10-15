import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUserId } from "@/lib/require-user";
import type { PoolClient } from "pg";

export const runtime = "nodejs";
const ttl = 3 * 60 * 60 * 1000;

type LiveCoupon = { type: string; paymentDate: string };
type LiveBond = Record<string, unknown> & { currency?: string; sellPrice?: number | null; coupons?: LiveCoupon[] };

function prepareLivePrices(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) return payload;
  const bonds = payload.data.filter((bond): bond is LiveBond => {
    if (!bond || typeof bond !== "object") return false;
    const item = bond as LiveBond;
    return item.currency === "UAH" && typeof item.sellPrice === "number" && Number.isFinite(item.sellPrice);
  }).map(bond => ({
    ...bond,
    coupons: [...(Array.isArray(bond.coupons) ? bond.coupons : [])].sort((a, b) => {
      const dateKey = (value: string) => value.split(".").reverse().join("-");
      const dateOrder = dateKey(a.paymentDate).localeCompare(dateKey(b.paymentDate));
      if (dateOrder) return dateOrder;
      return a.type === "Погашення" ? 1 : b.type === "Погашення" ? -1 : 0;
    }),
  }));
  return { ...payload, data: bonds };
}

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
  return prepareLivePrices(data);
}

export async function GET() {
  const ownerId = await requireUserId();
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let client: PoolClient | undefined;
  let stale: { payload: unknown; fetchedAt: Date } | undefined;
  let locked = false;
  try {
    client = await getPool().connect();
    const { rows } = await client.query("SELECT payload, fetched_at AS \"fetchedAt\" FROM live_prices_cache WHERE id = 1");
    stale = { payload: rows[0].payload, fetchedAt: rows[0].fetchedAt };
    if (Date.now() - new Date(stale.fetchedAt).getTime() < ttl) {
      return NextResponse.json({ data: prepareLivePrices(stale.payload), fetchedAt: stale.fetchedAt, stale: false });
    }

    const lock = await client.query("SELECT pg_try_advisory_lock(hashtext('obl-live-prices-refresh')) AS locked");
    locked = lock.rows[0].locked;
    if (!locked) {
      if (stale.payload && Object.keys(stale.payload as object).length) {
        return NextResponse.json({ data: prepareLivePrices(stale.payload), fetchedAt: stale.fetchedAt, stale: true });
      }
      return NextResponse.json({ error: "Live price refresh is in progress." }, { status: 503 });
    }

    const latest = await client.query("SELECT payload, fetched_at AS \"fetchedAt\" FROM live_prices_cache WHERE id = 1");
    stale = { payload: latest.rows[0].payload, fetchedAt: latest.rows[0].fetchedAt };
    if (Date.now() - new Date(stale.fetchedAt).getTime() < ttl) {
      return NextResponse.json({ data: prepareLivePrices(stale.payload), fetchedAt: stale.fetchedAt, stale: false });
    }

    const data = await fetchLivePrices();
    const { rows: saved } = await client.query(
      "UPDATE live_prices_cache SET payload = $1, fetched_at = NOW() WHERE id = 1 RETURNING fetched_at AS \"fetchedAt\"",
      [JSON.stringify(data)],
    );
    return NextResponse.json({ data, fetchedAt: saved[0].fetchedAt, stale: false });
  } catch (error) {
    console.error("Could not refresh live prices", error);
    if (stale && stale.payload && Object.keys(stale.payload as object).length) {
      return NextResponse.json({ data: prepareLivePrices(stale.payload), fetchedAt: stale.fetchedAt, stale: true });
    }
    return NextResponse.json({ error: "Could not load live bond prices from Privat24." }, { status: 503 });
  } finally {
    if (client) {
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('obl-live-prices-refresh'))").catch(() => {});
      client.release();
    }
  }
}
