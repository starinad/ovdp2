import { isIsoDate } from "@/lib/dates";
import { validatePurchase } from "@/lib/envelop-types";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";
const validId = (id: string) => /^\d+$/.test(id) && Number(id) > 0;
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ownerId = await requireUserId();
  if (!ownerId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!validId(id))
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!validatePurchase(body) || !isIsoDate(body.purchasedAt)) {
    return NextResponse.json(
      {
        error:
          "Enter a valid date and positive UAH spent and USD received amounts",
      },
      { status: 400 },
    );
  }
  try {
    const { rows } = await getPool().query(
      'UPDATE envelop_purchases SET spent_uah = $1, received_usd = $2, purchased_at = $3::date WHERE id = $4 AND owner_id = $5 RETURNING id, spent_uah AS "spentUah", received_usd AS "receivedUsd", purchased_at AS "purchasedAt"',
      [body.spentUah, body.receivedUsd, body.purchasedAt, id, ownerId],
    );
    return rows.length
      ? NextResponse.json(rows[0])
      : NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  } catch (error) {
    console.error("Could not update Envelop purchase", error);
    return NextResponse.json(
      { error: "Could not update Envelop purchase" },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ownerId = await requireUserId();
  if (!ownerId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!validId(id))
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  try {
    const { rowCount } = await getPool().query(
      "DELETE FROM envelop_purchases WHERE id = $1 AND owner_id = $2",
      [id, ownerId],
    );
    return rowCount
      ? new Response(null, { status: 204 })
      : NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  } catch (error) {
    console.error("Could not delete Envelop purchase", error);
    return NextResponse.json(
      { error: "Could not delete Envelop purchase" },
      { status: 503 },
    );
  }
}
