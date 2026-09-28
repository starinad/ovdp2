import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function GET() {
  const ownerId = await requireUserId();
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows } = await getPool().query(
      `SELECT c.id, b.name AS "bondName", b.isin, b.currency,
        c.payment_date AS "paymentDate", c.gross_amount AS "grossAmount",
        c.tax_amount AS "taxAmount", c.net_amount AS "netAmount", c.status
       FROM coupons c JOIN bonds b ON b.id = c.bond_id
       WHERE b.owner_id = $1 ORDER BY c.payment_date, b.name`,
      [ownerId],
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Could not load coupons", error);
    return NextResponse.json({ error: "Could not load coupons. Check the database connection and schema." }, { status: 503 });
  }
}
