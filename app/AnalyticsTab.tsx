"use client";

import { useEffect, useMemo, useState } from "react";

type Bond = { id: string; isin: string; name: string; status: string; faceValue: number; quantity: number; purchasePrice: number; purchaseDate: string; currency: string; interestRate: number; maturityDate: string };
type Coupon = { id: string; bondName: string; isin: string; currency: string; paymentDate: string; netAmount: number; status: string };
type Position = Bond & { invested: number; principal: number; monthsToMaturity: number };
type CashFlow = { date: string; amount: number };
const money = (value: number, currency = "UAH") => new Intl.NumberFormat("uk-UA", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const preciseMoney = (value: number) => new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 2 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
const colors = ["#3477e9", "#67a2f0", "#89d1db", "#c4d9ef", "#9b8bf4", "#edaa62"];

function xirr(flows: CashFlow[]) {
  if (!flows.some(flow => flow.amount > 0) || !flows.some(flow => flow.amount < 0)) return null;
  const firstDate = Math.min(...flows.map(flow => new Date(`${flow.date.slice(0, 10)}T00:00:00Z`).getTime()));
  const npv = (rate: number) => flows.reduce((sum, flow) => sum + flow.amount / (1 + rate) ** ((new Date(`${flow.date.slice(0, 10)}T00:00:00Z`).getTime() - firstDate) / 31_536_000_000), 0);
  let low = -0.9999;
  let high = 1;
  while (npv(low) * npv(high) > 0 && high < 1_000_000) high = high * 2 + 1;
  if (npv(low) * npv(high) > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (npv(low) * npv(mid) <= 0) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

function CashflowChart({ coupons }: { coupons: Coupon[] }) {
  const [range, setRange] = useState(6);
  const months = useMemo(() => {
    const now = new Date();
    const today = now.toLocaleDateString("sv-SE");
    return Array.from({ length: range }, (_, i) => {
      const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2, "0");
      const payments = coupons.filter(c => c.currency === "UAH" && c.status !== "CANCELLED" && c.paymentDate.slice(0, 10) >= today && c.paymentDate.slice(0, 7) === key);
      return { key, label: new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(key + "-01T00:00:00Z")), payments, amount: payments.reduce((sum, c) => sum + Number(c.netAmount), 0) };
    });
  }, [coupons, range]);
  const max = Math.max(1, ...months.map(m => m.amount));
  return <article className="panel analytics-chart-panel"><div className="panel-head"><div><h2>Coupon income</h2><p>Scheduled net UAH payments · starting this month</p></div><div className="segmented" aria-label="Forecast length">{[3, 6, 12].map(n => <button key={n} className={range === n ? "selected" : ""} aria-pressed={range === n} onClick={() => setRange(n)}>{n}M</button>)}</div></div><div className="coupon-income-list">{months.map(month => <div className="coupon-income-row" key={month.key}><div className="coupon-income-month"><strong>{month.label}</strong><span>{month.payments.length} {month.payments.length === 1 ? "payment" : "payments"}</span></div><div className="coupon-income-track" role="progressbar" aria-label={month.label + " scheduled coupon income"} aria-valuemin={0} aria-valuemax={max} aria-valuenow={month.amount}><i style={{ width: month.amount / max * 100 + "%" }}/></div><strong className="coupon-income-amount">{preciseMoney(month.amount)}</strong></div>)}</div><div className="analytics-chart-total"><span>{"Scheduled total · next " + range + " months"}</span><strong>{preciseMoney(months.reduce((sum, month) => sum + month.amount, 0))}</strong></div></article>;
}

export default function AnalyticsTab() {
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/bonds"), fetch("/api/coupons")]).then(async ([br, cr]) => {
      const [bd, cd] = await Promise.all([br.json(), cr.json()]);
      if (!br.ok || !cr.ok) throw new Error(bd.error || cd.error || "Could not load analytics");
      if (active) { setBonds(bd); setCoupons(cd); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Could not load analytics"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const positions = useMemo(() => {
    return bonds.filter(b => b.status === "ACTIVE").map(b => {
      const maturity = new Date(`${b.maturityDate.slice(0, 10)}T00:00:00Z`);
      const today = new Date();
      const monthsToMaturity = Math.max(0, (maturity.getUTCFullYear() - today.getUTCFullYear()) * 12 + maturity.getUTCMonth() - today.getUTCMonth());
      return { ...b, invested: Number(b.purchasePrice) * Number(b.quantity), principal: Number(b.faceValue) * Number(b.quantity), monthsToMaturity };
    });
  }, [bonds]);
  const uah = positions.filter(p => p.currency === "UAH");
  const totalFaceValue = uah.reduce((sum, p) => sum + p.principal, 0);
  const invested = uah.reduce((sum, p) => sum + p.invested, 0);
  const today = new Date().toLocaleDateString("sv-SE");
  const yearFromToday = new Date();
  yearFromToday.setFullYear(yearFromToday.getFullYear() + 1);
  const annualThrough = yearFromToday.toLocaleDateString("sv-SE");
  const threeMonthsFromToday = new Date();
  threeMonthsFromToday.setMonth(threeMonthsFromToday.getMonth() + 3);
  const threeMonthThrough = threeMonthsFromToday.toLocaleDateString("sv-SE");
  const upcoming = coupons.filter(c => c.currency === "UAH" && c.status !== "CANCELLED" && c.paymentDate.slice(0, 10) >= today).sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  const nextThreeMonths = upcoming.filter(c => c.paymentDate.slice(0, 10) <= threeMonthThrough);
  const totalCouponIncome = upcoming.reduce((sum, c) => sum + Number(c.netAmount), 0);
  const annualCouponIncome = upcoming.filter(c => c.paymentDate.slice(0, 10) <= annualThrough).reduce((sum, c) => sum + Number(c.netAmount), 0);
  const currencies = ["UAH"];
  const metrics = currencies.map(currency => {
    const currencyBonds = bonds.filter(b => b.currency === currency && b.status !== "SOLD");
    const eligibleIsins = new Set(currencyBonds.map(b => b.isin));
    const flows: CashFlow[] = currencyBonds.flatMap(bond => {
      const principal = Number(bond.faceValue) * Number(bond.quantity);
      const investment = Number(bond.purchasePrice) * Number(bond.quantity);
      return [{ date: bond.purchaseDate, amount: -investment }, ...(bond.status === "ACTIVE"
        ? [{ date: today, amount: principal }]
        : [{ date: bond.maturityDate, amount: principal }])];
    });
    for (const coupon of coupons) {
      if (coupon.currency === currency && coupon.status !== "CANCELLED" && coupon.paymentDate.slice(0, 10) <= today && eligibleIsins.has(coupon.isin)) flows.push({ date: coupon.paymentDate, amount: Number(coupon.netAmount) });
    }
    const faceValue = positions.filter(p => p.currency === currency).reduce((sum, p) => sum + p.principal, 0);
    const purchaseCost = positions.filter(p => p.currency === currency).reduce((sum, p) => sum + p.invested, 0);
    const scheduledIncome = coupons.filter(c => c.currency === currency && c.status !== "CANCELLED" && c.paymentDate.slice(0, 10) >= today).reduce((sum, c) => sum + Number(c.netAmount), 0);
    const unrealizedGain = faceValue - purchaseCost;
    const projectionReturn = scheduledIncome + unrealizedGain;
    const receivedIncome = coupons.filter(c => c.currency === currency && c.status !== "CANCELLED" && c.paymentDate.slice(0, 10) <= today).reduce((sum, c) => sum + Number(c.netAmount), 0);
    return { currency, xirr: xirr(flows), projectionReturn, roi: purchaseCost ? projectionReturn / purchaseCost : null, receivedIncome };
  });
  const uahMetrics = metrics[0];
  const ladder = [{ label: "0–3 months", max: 3 }, { label: "3–6 months", max: 6 }, { label: "6–12 months", max: 12 }, { label: "1–2 years", max: 24 }, { label: "2–5 years", max: 60 }, { label: "5+ years", max: Infinity }].map((bucket, i, buckets) => {
    const bonds = uah.filter(p => p.monthsToMaturity >= (i ? buckets[i - 1].max : 0) && p.monthsToMaturity < bucket.max);
    return { ...bucket, bonds, amounts: bonds.reduce<Record<string, number>>((sum, p) => ({ ...sum, [p.currency]: (sum[p.currency] || 0) + p.principal }), {}) };
  });
  const currencyMax = { UAH: Math.max(1, ...ladder.map(bucket => bucket.amounts.UAH || 0)) };

  return <>
    <div className="welcome-row"><div><div className="eyebrow">YOUR PORTFOLIO</div><h1>Portfolio <span>analytics.</span></h1><p className="subhead">A current view of your holdings and coupon income.</p></div></div>
    {error ? <div className="bond-state panel" role="alert">{error}</div> : loading ? <div className="bond-state panel">Loading portfolio analytics…</div> : <>
      <section className="stats analytics-stats">
        <article className="stat-card"><div className="stat-top"><span>Total face value · UAH</span><span className="stat-icon">₴</span></div><div className="stat-value">{money(totalFaceValue)}</div><div className="stat-foot"><span>Active UAH positions</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Purchase cost · UAH</span><span className="stat-icon">↗</span></div><div className="stat-value">{money(invested)}</div><div className="stat-foot"><span>Active UAH positions</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Unrealized capital gain/loss · UAH</span><span className="stat-icon">±</span></div><div className={`stat-value ${totalFaceValue >= invested ? "positive" : ""}`}>{money(totalFaceValue - invested)}</div><div className="stat-foot"><span>Total face value − purchase cost</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Total scheduled income · UAH</span><span className="stat-icon">◷</span></div><div className="stat-value">{money(totalCouponIncome)}</div><div className="stat-foot"><span>Annualized (12 months): {money(annualCouponIncome)} · Monthly average: {money(annualCouponIncome / 12)}</span></div></article>
      </section>
      <section className="stats analytics-extra-stats">
        <article className="stat-card"><div className="stat-top"><span>Portfolio XIRR · UAH</span><span className="stat-icon">%</span></div><div className="stat-value">{percent(uahMetrics.xirr)}</div><div className="stat-foot"><span>Face value basis</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Total projection return · UAH</span><span className="stat-icon">↗</span></div><div className="stat-value">{money(uahMetrics.projectionReturn)}</div><div className="stat-foot"><span>Scheduled income + unrealized gain/loss</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Return on investment · UAH</span><span className="stat-icon">%</span></div><div className="stat-value">{percent(uahMetrics.roi)}</div><div className="stat-foot"><span>Projection return ÷ purchase cost</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Total net coupon income received · UAH</span><span className="stat-icon">₴</span></div><div className="stat-value">{money(uahMetrics.receivedIncome)}</div><div className="stat-foot"><span>Past scheduled dates; actual receipt is not tracked</span></div></article>
      </section>
      <section className="overview-grid analytics-overview"><CashflowChart coupons={coupons}/><article className="panel allocation analytics-allocation"><div className="panel-head"><div><h2>Maturity ladder · UAH</h2><p>UAH principal by time to maturity</p></div></div>{uah.length ? <div className="maturity-ladder">{ladder.map(bucket => <div className="maturity-bucket" key={bucket.label}><div className="maturity-bucket-head"><strong>{bucket.label}</strong><span>{bucket.bonds.length} {bucket.bonds.length === 1 ? "bond" : "bonds"}</span></div>{Object.entries(bucket.amounts).map(([currency, amount]) => <div className="maturity-value" key={currency}><div className="maturity-value-label"><span>{currency}</span><strong>{money(amount, currency)}</strong></div><div className="maturity-track"><i style={{ width: `${amount / currencyMax[currency as "UAH"] * 100}%` }}/></div></div>)}</div>)}</div> : <div className="analytics-empty">Add active UAH bonds to see maturity distribution.</div>}</article></section>
      <section className="panel analytics-upcoming"><div className="panel-head"><div><h2>Upcoming UAH coupons</h2><p>Scheduled payments in the next 3 months · after tax</p></div></div>{nextThreeMonths.length ? nextThreeMonths.map(c => <div className="coupon-item" key={c.id}><div className="calendar-tile"><b>{new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(`${c.paymentDate.slice(0, 10)}T00:00:00Z`)).toUpperCase()}</b><strong>{c.paymentDate.slice(8, 10)}</strong></div><div className="coupon-detail"><strong>{c.bondName}</strong><span>{c.isin} · {date(c.paymentDate)}</span></div><strong className="coupon-amount">{money(Number(c.netAmount))}</strong></div>) : <div className="analytics-empty">No UAH coupons scheduled in the next 3 months.</div>}</section>
    </>}
  </>;
}
