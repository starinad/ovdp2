import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { validateBond } from "@/lib/bond-types";

export const runtime = "nodejs";
const columns = `id, isin, name, status, face_value AS "faceValue", quantity,
  purchase_price AS "purchasePrice", currency, interest_rate AS "interestRate",
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
  try {
    const values = [bond.isin, bond.name, bond.status, bond.faceValue, bond.quantity, bond.purchasePrice, bond.currency, bond.interestRate, bond.purchaseDate, bond.maturityDate, bond.firstCouponDate, bond.couponFrequency, bond.dayCountConvention, bond.fixedCoupon, id];
    const { rows } = await getPool().query(
      `UPDATE bonds SET isin=$1, name=$2, status=$3, face_value=$4, quantity=$5, purchase_price=$6, currency=$7, interest_rate=$8, purchase_date=$9, maturity_date=$10, first_coupon_date=$11, coupon_frequency=$12, day_count_convention=$13, fixed_coupon=$14 WHERE id=$15 RETURNING ${columns}`,
      values,
    );
    return rows.length ? NextResponse.json(rows[0]) : NextResponse.json({ error: "Bond not found" }, { status: 404 });
  } catch (error) {
    console.error("Could not update bond", error);
    return NextResponse.json({ error: "Could not update bond. Check the database connection." }, { status: 503 });
  }
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
