import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { validateBond } from "@/lib/bond-types";
import { replaceCouponSchedule } from "@/lib/coupons";
import type { PoolClient } from "pg";

export const runtime = "nodejs";
const columns = `id, isin, name, status, face_value AS "faceValue", quantity,
  purchase_price AS "purchasePrice", currency, interest_rate AS "interestRate", tax_rate AS "taxRate",
  purchase_date AS "purchaseDate", maturity_date AS "maturityDate",
  first_coupon_date AS "firstCouponDate", coupon_frequency AS "couponFrequency",
  day_count_convention AS "dayCountConvention", fixed_coupon AS "fixedCoupon"`;
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: "Bond not found" }, { status: 404 });
  let bond: unknown;
  try { bond = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!validateBond(bond)) return NextResponse.json({ error: "Please provide valid bond details" }, { status: 400 });
  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    const values = [bond.isin, bond.name, bond.status, bond.faceValue, bond.quantity, bond.purchasePrice, bond.currency, bond.interestRate, bond.taxRate, bond.purchaseDate, bond.maturityDate, bond.firstCouponDate, bond.couponFrequency, bond.dayCountConvention, bond.fixedCoupon, id];
    const { rows } = await client.query(
      `UPDATE bonds SET isin=$1, name=$2, status=$3, face_value=$4, quantity=$5, purchase_price=$6, currency=$7, interest_rate=$8, tax_rate=$9, purchase_date=$10, maturity_date=$11, first_coupon_date=$12, coupon_frequency=$13, day_count_convention=$14, fixed_coupon=$15 WHERE id=$16 RETURNING ${columns}`,
      values,
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Bond not found" }, { status: 404 });
    }
    await replaceCouponSchedule(client, id, bond);
    await client.query("COMMIT");
    return NextResponse.json(rows[0]);
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});
    console.error("Could not update bond", error);
    return NextResponse.json({ error: "Could not update bond. Check the database connection." }, { status: 503 });
  } finally { client?.release(); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: "Bond not found" }, { status: 404 });
  try {
    const { rowCount } = await getPool().query("DELETE FROM bonds WHERE id = $1", [id]);
    return rowCount ? new Response(null, { status: 204 }) : NextResponse.json({ error: "Bond not found" }, { status: 404 });
  } catch (error) {
    console.error("Could not delete bond", error);
    return NextResponse.json({ error: "Could not delete bond. Check the database connection." }, { status: 503 });
  }
}
