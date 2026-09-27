import { BondInput } from "@/lib/bond-types";
import type { PoolClient } from "pg";

const monthsPerCoupon = { MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12, AT_MATURITY: 0 };
const msPerDay = 86_400_000;
const utc = (value: string) => new Date(`${value}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

function addMonths(date: Date, months: number) {
  const day = date.getUTCDate();
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  result.setUTCDate(Math.min(day, new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()));
  return result;
}

function daysBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / msPerDay;
}

function yearFraction(start: Date, end: Date, convention: BondInput["dayCountConvention"]) {
  if (convention === "30/360") {
    const d1 = Math.min(start.getUTCDate(), 30);
    const d2 = end.getUTCDate() === 31 && d1 === 30 ? 30 : end.getUTCDate();
    const days = (end.getUTCFullYear() - start.getUTCFullYear()) * 360
      + (end.getUTCMonth() - start.getUTCMonth()) * 30 + d2 - d1;
    return { days, fraction: days / 360 };
  }

  const days = daysBetween(start, end);
  if (convention === "ACT/360") return { days, fraction: days / 360 };
  if (convention === "ACT/365") return { days, fraction: days / 365 };

  let fraction = 0;
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const segmentStart = start > yearStart ? start : yearStart;
    const segmentEnd = end < yearEnd ? end : yearEnd;
    if (segmentEnd > segmentStart) fraction += daysBetween(segmentStart, segmentEnd) / daysBetween(yearStart, yearEnd);
  }
  return { days, fraction };
}

function bankersRound(value: number) {
  const scaled = value * 100;
  const lower = Math.floor(scaled);
  const fraction = scaled - lower;
  if (Math.abs(fraction - 0.5) < 1e-8) return (lower % 2 === 0 ? lower : lower + 1) / 100;
  return Math.round(scaled) / 100;
}

export function generateCoupons(bond: BondInput) {
  const months = monthsPerCoupon[bond.couponFrequency];
  if (!months || bond.status === "SOLD") return [];

  const firstDate = utc(bond.firstCouponDate);
  const maturity = utc(bond.maturityDate);
  const purchase = utc(bond.purchaseDate);
  const dates: Date[] = [];
  for (let i = 0; ; i++) {
    const date = addMonths(firstDate, months * i);
    if (date > maturity) break;
    dates.push(date);
    // ponytail: 10,000 scheduled payments keeps one bond from creating an unreasonable bulk insert.
    if (dates.length > 10_000) throw new Error("Coupon schedule exceeds 10,000 payments");
  }

  const last = dates.at(-1);
  if (!last) dates.push(maturity);
  else {
    const gap = daysBetween(last, maturity);
    if (gap > 7) dates.push(maturity);
    else if (gap > 0) dates[dates.length - 1] = maturity;
  }

  const coupons = [];
  for (let i = 0; i < dates.length; i++) {
    const paymentDate = dates[i];
    if (paymentDate <= purchase) continue;
    const periodStart = i ? dates[i - 1] : addMonths(dates[0], -months);
    const period = yearFraction(periodStart, paymentDate, bond.dayCountConvention);
    if (period.days <= 0) continue;

    const grossAmount = bankersRound(Number(bond.fixedCoupon) > 0
      ? Number(bond.fixedCoupon) * Number(bond.quantity)
      : Number(bond.faceValue) * Number(bond.quantity) * Number(bond.interestRate) * period.fraction / 100);
    const taxAmount = bankersRound(grossAmount * Number(bond.taxRate) / 100);
    coupons.push({
      sequenceNumber: coupons.length + 1,
      paymentDate: iso(paymentDate),
      periodStart: iso(periodStart),
      periodEnd: iso(paymentDate),
      accruedDays: period.days,
      grossAmount,
      taxAmount,
      netAmount: bankersRound(grossAmount - taxAmount),
      dayCountConvention: bond.dayCountConvention,
      status: paymentDate.getTime() <= Date.now() ? "PAID" : "SCHEDULED",
      isFirst: coupons.length === 0,
      isLast: i === dates.length - 1,
      accruedAdjustment: 0,
    });
  }
  return coupons;
}

export async function replaceCouponSchedule(client: PoolClient, bondId: string, bond: BondInput) {
  await client.query("DELETE FROM coupons WHERE bond_id = $1", [bondId]);
  const coupons = generateCoupons(bond);
  for (let offset = 0; offset < coupons.length; offset += 500) {
    const batch = coupons.slice(offset, offset + 500);
    const values: unknown[] = [];
    const rows = batch.map((coupon, row) => {
      const start = row * 14;
      values.push(bondId, coupon.sequenceNumber, coupon.paymentDate, coupon.periodStart, coupon.periodEnd, coupon.accruedDays,
        coupon.grossAmount, coupon.taxAmount, coupon.netAmount, coupon.dayCountConvention, coupon.status,
        coupon.isFirst, coupon.isLast, coupon.accruedAdjustment);
      return `(${Array.from({ length: 14 }, (_, column) => `$${start + column + 1}`).join(",")})`;
    });
    await client.query(
      `INSERT INTO coupons (bond_id, sequence_number, payment_date, period_start, period_end, accrued_days, gross_amount, tax_amount, net_amount, day_count_convention, status, is_first, is_last, accrued_adjustment) VALUES ${rows.join(",")}`,
      values,
    );
  }
}
