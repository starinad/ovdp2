import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildForecast,
  ratesOnDate,
  toBaseCurrency,
  xirr,
} from "../lib/analytics";
import { isIsoDate, monthlyIncomeSnapshots } from "../lib/dates";
import { rateAtDate, type HistoricalRates } from "../lib/exchange-rates";
import { validatePurchase } from "../lib/envelop-types";
import { validateBond, type BondInput } from "../lib/bond-types";
import { generateCoupons } from "../lib/coupons";

const bond: BondInput = {
  isin: "UA4000231620",
  name: "Government bond",
  status: "ACTIVE",
  currency: "UAH",
  faceValue: "1000",
  quantity: "2",
  purchasePrice: "1000",
  interestRate: "12",
  taxRate: "10",
  purchaseDate: "2025-01-01",
  maturityDate: "2026-01-01",
  firstCouponDate: "2026-01-01",
  couponFrequency: "AT_MATURITY",
  dayCountConvention: "ACT/365",
  fixedCoupon: "0",
};

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test("date validation rejects rolled-over dates and non-strings", () => {
  assert.equal(isIsoDate("2024-02-29"), true);
  for (const value of [
    "2025-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-1-01",
    "2026-01-01T00:00:00Z",
    null,
    20260101,
  ]) {
    assert.equal(isIsoDate(value), false);
  }
});

test("monthly income includes today and uses the 28th for completed months", () => {
  for (const today of [
    new Date(2026, 9, 22),
    new Date(2026, 9, 28),
    new Date(2026, 9, 31),
    new Date(2026, 0, 1),
    new Date(2024, 1, 29),
  ]) {
    const snapshots = monthlyIncomeSnapshots(today);
    assert.equal(snapshots.length, 12);
    assert.equal(snapshots[11], today.toLocaleDateString("sv-SE"));
    assert.ok(snapshots.slice(0, 11).every(date => date.endsWith("-28")));
    assert.ok(snapshots.every((date, index) => !index || date > snapshots[index - 1]));
  }
  const october = monthlyIncomeSnapshots(new Date(2026, 9, 22));
  assert.equal(october[0], "2025-11-28");
  assert.equal(october[10], "2026-09-28");
  assert.equal(october[11], "2026-10-22");
  assert.equal(monthlyIncomeSnapshots(new Date(2026, 0, 1))[10], "2025-12-28");
});

test("historical FX uses only rates on or before the date, with per-currency fallback", () => {
  const history: HistoricalRates = {
    USD: [
      { date: "2026-01-02", rate: 40 },
      { date: "2026-01-05", rate: 41 },
    ],
    EUR: [],
  };
  const fallback = { USD: 42, EUR: 45 };
  assert.equal(rateAtDate(history, "USD", "2026-01-01"), undefined);
  assert.equal(rateAtDate(history, "USD", "2026-01-02T00:00:00Z"), 40);
  assert.equal(rateAtDate(history, "USD", "2026-01-04"), 40);
  assert.equal(rateAtDate(history, "USD", "2026-01-06"), 41);
  assert.deepEqual(ratesOnDate(history, "2026-01-01", fallback), fallback);
  assert.deepEqual(ratesOnDate(history, "2026-01-05", fallback), {
    USD: 41,
    EUR: 45,
  });
  assert.deepEqual(ratesOnDate(null, "2026-01-05", fallback), fallback);
});

test("currency conversion preserves same-currency amounts and crosses through UAH", () => {
  const rates = { USD: 40, EUR: 50 };
  assert.equal(toBaseCurrency(100, "USD", "UAH", rates), 4000);
  assert.equal(toBaseCurrency(100, "USD", "EUR", rates), 80);
  assert.equal(toBaseCurrency(100, "EUR", "EUR", rates), 100);
});

test("forecast compounds starting capital and adds contributions at month end", () => {
  const flat = buildForecast(100, 0, 1000);
  assert.equal(flat.length, 37);
  assert.deepEqual(flat[0], { value: 1000, contributed: 0 });
  assert.deepEqual(flat[36], { value: 4600, contributed: 3600 });
  close(buildForecast(0, 0.12, 1000)[12].value, 1120);
  close(buildForecast(100, 0.12, 1000)[1].value, 1000 * 1.12 ** (1 / 12) + 100);
});

test("XIRR handles annual gain, loss, and one-sided cashflows", () => {
  const purchase = { date: "2025-01-01", amount: -1000 };
  close(xirr([purchase, { date: "2026-01-01", amount: 1100 }])!, 0.1);
  close(xirr([purchase, { date: "2026-01-01", amount: 900 }])!, -0.1);
  assert.equal(xirr([purchase]), null);
  assert.equal(xirr([]), null);
});

test("purchase validation rejects invalid amounts without coercion", () => {
  assert.equal(validatePurchase({ spentUah: 4000, receivedUsd: 100 }), true);
  for (const amount of [0, -1, NaN, Infinity, "100", null]) {
    assert.equal(
      validatePurchase({ spentUah: amount, receivedUsd: 100 }),
      false,
    );
    assert.equal(
      validatePurchase({ spentUah: 4000, receivedUsd: amount }),
      false,
    );
  }
  assert.equal(validatePurchase(null), false);
  assert.equal(validatePurchase([]), false);
});

test("bond validation shares calendar validation and keeps domain constraints", () => {
  assert.equal(validateBond(bond), true);
  assert.equal(validateBond({ ...bond, purchaseDate: "2025-02-29" }), false);
  assert.equal(validateBond({ ...bond, taxRate: "101" }), false);
  assert.equal(validateBond({ ...bond, maturityDate: "2024-01-01" }), false);
});

test("coupon schedules keep interest separate from principal and respect tax and sold positions", () => {
  const coupons = generateCoupons(bond);
  assert.equal(coupons.length, 1);
  assert.equal(coupons[0].grossAmount, 240);
  assert.equal(coupons[0].taxAmount, 24);
  assert.equal(coupons[0].netAmount, 216);
  assert.equal(coupons[0].paymentDate, "2026-01-01");
  assert.deepEqual(generateCoupons({ ...bond, status: "SOLD" }), []);
  assert.equal(
    generateCoupons({ ...bond, fixedCoupon: "50" })[0].grossAmount,
    100,
  );
});
