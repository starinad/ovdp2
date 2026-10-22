import { validatePurchase } from "@/lib/envelop-types";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function GET() {
  const ownerId = await requireUserId();
  if (!ownerId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows } = await getPool().query(
      'SELECT id, spent_uah AS "spentUah", received_usd AS "receivedUsd", purchased_at AS "purchasedAt" FROM envelop_purchases WHERE owner_id = $1 ORDER BY purchased_at DESC, id DESC',
      [ownerId],
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Could not load Envelop purchases", error);
    return NextResponse.json(
      { error: "Could not load Envelop purchases" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const ownerId = await requireUserId();
  if (!ownerId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!validatePurchase(body)) {
    return NextResponse.json(
      { error: "Enter positive UAH spent and USD received amounts" },
      { status: 400 },
    );
  }
  try {
    const { rows } = await getPool().query(
      'INSERT INTO envelop_purchases (owner_id, spent_uah, received_usd) VALUES ($1, $2, $3) RETURNING id, spent_uah AS "spentUah", received_usd AS "receivedUsd", purchased_at AS "purchasedAt"',
      [ownerId, body.spentUah, body.receivedUsd],
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("Could not save Envelop purchase", error);
    return NextResponse.json(
      { error: "Could not save Envelop purchase" },
      { status: 503 },
    );
  }
}
