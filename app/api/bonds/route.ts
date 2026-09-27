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

export async function GET() {
  try {
    const { rows } = await getPool().query(`SELECT ${columns} FROM bonds ORDER BY maturity_date, name`);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Could not load bonds", error);
    return NextResponse.json({ error: "Could not load bonds. Check the database connection and schema." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let bond: unknown;
  try { bond = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!validateBond(bond)) return NextResponse.json({ error: "Please provide valid bond details" }, { status: 400 });
  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    const values = [bond.isin, bond.name, bond.status, bond.faceValue, bond.quantity, bond.purchasePrice, bond.currency, bond.interestRate, bond.taxRate, bond.purchaseDate, bond.maturityDate, bond.firstCouponDate, bond.couponFrequency, bond.dayCountConvention, bond.fixedCoupon];
    const { rows } = await client.query(
      `INSERT INTO bonds (isin, name, status, face_value, quantity, purchase_price, currency, interest_rate, tax_rate, purchase_date, maturity_date, first_coupon_date, coupon_frequency, day_count_convention, fixed_coupon)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING ${columns}`,
      values,
    );
    await replaceCouponSchedule(client, rows[0].id, bond);
    await client.query("COMMIT");
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});
    console.error("Could not create bond", error);
    return NextResponse.json({ error: "Could not save bond. Check the database connection." }, { status: 503 });
  } finally { client?.release(); }
}
