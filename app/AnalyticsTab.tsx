"use client";

import { useEffect, useMemo, useState } from "react";

type Currency = "UAH" | "USD" | "EUR";
type FxRates = Record<Exclude<Currency, "UAH">, number>;
type ExchangeRates = { USD: { rate: number }; EUR: { rate: number } };
type HistoricalRates = Record<Exclude<Currency, "UAH">, { date: string; rate: number }[]>;
type Bond = { id: string; isin: string; name: string; status: string; faceValue: number; quantity: number; purchasePrice: number; purchaseDate: string; currency: Currency; interestRate: number; maturityDate: string };
type Coupon = { id: string; bondId: string; bondName: string; isin: string; currency: string; paymentDate: string; netAmount: number; status: string };
type Position = Bond & { invested: number; principal: number; monthsToMaturity: number };
type CashFlow = { date: string; amount: number };
const money = (value: number, currency = "UAH") => new Intl.NumberFormat("uk-UA", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const preciseCurrency = (value: number, currency: Currency) => new Intl.NumberFormat("uk-UA", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const preciseMoney = (value: number) => preciseCurrency(value, "UAH");
const percent = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 2 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
const colors = ["#3477e9", "#67a2f0", "#89d1db", "#c4d9ef", "#9b8bf4", "#edaa62"];

function toBaseCurrency(value: number, from: Currency, to: Currency, rates: FxRates) {
  const uahValue = from === "UAH" ? value : value * rates[from];
  return to === "UAH" ? uahValue : uahValue / rates[to];
}

function ratesOnDate(history: HistoricalRates | null, date: string, fallback: FxRates): FxRates {
  if (!history) return fallback;
  const result = { ...fallback };
  for (const currency of ["USD", "EUR"] as const) {
    for (const entry of history[currency]) {
      if (entry.date > date) break;
      result[currency] = entry.rate;
    }
  }
  return result;
}

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

function CashflowChart({ coupons, rates }: { coupons: Coupon[]; rates: FxRates }) {
  const [range, setRange] = useState(6);
  const months = useMemo(() => {
    const now = new Date();
    const today = now.toLocaleDateString("sv-SE");
    return Array.from({ length: range }, (_, i) => {
      const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2, "0");
      const payments = coupons.filter(c => c.status !== "CANCELLED" && c.paymentDate.slice(0, 10) >= today && c.paymentDate.slice(0, 7) === key);
      return { key, label: new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(key + "-01T00:00:00Z")), payments, amount: payments.reduce((sum, c) => sum + toBaseCurrency(Number(c.netAmount), c.currency as Currency, "UAH", rates), 0) };
    });
  }, [coupons, range, rates]);
  const max = Math.max(1, ...months.map(m => m.amount));
  return <article className="panel analytics-chart-panel"><div className="panel-head"><div><h2>Coupon income equivalent · UAH</h2><p>All scheduled currencies converted at live NBU rates</p></div><div className="segmented" aria-label="Forecast length">{[3, 6, 12].map(n => <button key={n} className={range === n ? "selected" : ""} aria-pressed={range === n} onClick={() => setRange(n)}>{n}M</button>)}</div></div><div className="coupon-income-list">{months.map(month => <div className="coupon-income-row" key={month.key}><div className="coupon-income-month"><strong>{month.label}</strong><span>{month.payments.length} {month.payments.length === 1 ? "payment" : "payments"}</span></div><div className="coupon-income-track" role="progressbar" aria-label={month.label + " scheduled coupon income"} aria-valuemin={0} aria-valuemax={max} aria-valuenow={month.amount}><i style={{ width: month.amount / max * 100 + "%" }}/></div><strong className="coupon-income-amount">{preciseMoney(month.amount)}</strong></div>)}</div><div className="analytics-chart-total"><span>{"Scheduled total · next " + range + " months"}</span><strong>{preciseMoney(months.reduce((sum, month) => sum + month.amount, 0))}</strong></div></article>;
}

export default function AnalyticsTab() {
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [historicalRates, setHistoricalRates] = useState<HistoricalRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/bonds"), fetch("/api/coupons"), fetch("/api/exchange-rates")]).then(async ([br, cr, er]) => {
      const [bd, cd, ed] = await Promise.all([br.json(), cr.json(), er.json()]);
      if (!br.ok || !cr.ok || !er.ok) throw new Error(bd.error || cd.error || ed.error || "Could not load analytics");
      const incomeBondIds = new Set(bd.filter((bond: Bond) => bond.status !== "SOLD").map((bond: Bond) => bond.id));
      const received = cd.filter((coupon: Coupon) => incomeBondIds.has(coupon.bondId) && coupon.status !== "CANCELLED" && coupon.paymentDate.slice(0, 10) <= new Date().toLocaleDateString("sv-SE"));
      const dates = [
        ...bd.filter((bond: Bond) => bond.status !== "SOLD").flatMap((bond: Bond) => [bond.purchaseDate.slice(0, 10), ...(bond.status !== "ACTIVE" ? [bond.maturityDate.slice(0, 10)] : [])]),
        ...received.map((coupon: Coupon) => coupon.paymentDate.slice(0, 10)),
      ];
      if (dates.length) {
        const firstDate = dates.reduce((first, value) => value < first ? value : first, dates[0]);
        const startDate = new Date(`${firstDate}T00:00:00Z`);
        startDate.setUTCDate(startDate.getUTCDate() - 10);
        const start = startDate.toISOString().slice(0, 10);
        const end = new Date().toLocaleDateString("sv-SE");
        try {
          const historyResponse = await fetch(`/api/exchange-rates/history?start=${start}&end=${end}`);
          if (historyResponse.ok) {
            const rates = await historyResponse.json();
            if (active) setHistoricalRates(rates);
          }
        } catch { /* live NBU rates remain available as fallbacks */ }
      }
      if (active) { setBonds(bd); setCoupons(cd); setExchangeRates(ed); }
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
  const liveFx = useMemo<FxRates>(() => ({
    USD: Number(exchangeRates?.USD.rate) || 1,
    EUR: Number(exchangeRates?.EUR.rate) || 1,
  }), [exchangeRates]);
  const baseCurrencies: Currency[] = ["UAH", "USD", "EUR"];
  const today = new Date().toLocaleDateString("sv-SE");
  const incomeBondIds = new Set(bonds.filter(bond => bond.status !== "SOLD").map(bond => bond.id));
  const receivedCoupons = coupons.filter(coupon => incomeBondIds.has(coupon.bondId) && coupon.status !== "CANCELLED" && coupon.paymentDate.slice(0, 10) <= today);
  const incomeBonds = bonds.filter(bond => bond.status !== "SOLD");
  const reinvestmentEvents = incomeBonds.map(bond => {
    const purchaseFx = ratesOnDate(historicalRates, bond.purchaseDate.slice(0, 10), liveFx);
    return { date: bond.purchaseDate.slice(0, 10), amount: -toBaseCurrency(Number(bond.purchasePrice) * Number(bond.quantity), bond.currency, "UAH", purchaseFx) };
  });
  for (const bond of incomeBonds.filter(bond => bond.status !== "ACTIVE" && bond.maturityDate.slice(0, 10) <= today)) {
    const maturityFx = ratesOnDate(historicalRates, bond.maturityDate.slice(0, 10), liveFx);
    reinvestmentEvents.push({ date: bond.maturityDate.slice(0, 10), amount: toBaseCurrency(Number(bond.faceValue) * Number(bond.quantity), bond.currency, "UAH", maturityFx) });
  }
  const couponsInCurrency = { USD: 0, EUR: 0 };
  for (const coupon of receivedCoupons) {
    const paymentFx = ratesOnDate(historicalRates, coupon.paymentDate.slice(0, 10), liveFx);
    const amount = Number(coupon.netAmount);
    reinvestmentEvents.push({ date: coupon.paymentDate.slice(0, 10), amount: toBaseCurrency(amount, coupon.currency as Currency, "UAH", paymentFx) });
    couponsInCurrency.USD += toBaseCurrency(amount, coupon.currency as Currency, "USD", paymentFx);
    couponsInCurrency.EUR += toBaseCurrency(amount, coupon.currency as Currency, "EUR", paymentFx);
  }
  reinvestmentEvents.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  let reinvestedCashUah = 0;
  let externalInvestmentUah = 0;
  const currencyUnitsBought = { USD: 0, EUR: 0 };
  for (const event of reinvestmentEvents) {
    if (event.amount > 0) {
      reinvestedCashUah += event.amount;
      continue;
    }
    const purchaseCost = -event.amount;
    const reinvestedAmount = Math.min(reinvestedCashUah, purchaseCost);
    reinvestedCashUah -= reinvestedAmount;
    const externalAmount = purchaseCost - reinvestedAmount;
    externalInvestmentUah += externalAmount;
    const purchaseFx = ratesOnDate(historicalRates, event.date, liveFx);
    currencyUnitsBought.USD += externalAmount / purchaseFx.USD;
    currencyUnitsBought.EUR += externalAmount / purchaseFx.EUR;
  }
  const currentBondValueUah = positions.reduce((sum, bond) => sum + toBaseCurrency(bond.principal, bond.currency, "UAH", liveFx), 0);
  const currencyComparison = (["USD", "EUR"] as const).map(currency => {
    const unitsBought = currencyUnitsBought[currency];
    const currencyValueUah = unitsBought * liveFx[currency];
    return {
      currency,
      unitsBought,
      currencyValueUah,
      currencyReturn: externalInvestmentUah ? (currencyValueUah - externalInvestmentUah) / externalInvestmentUah : null,
      couponsInCurrency: couponsInCurrency[currency],
      bondValue: currentBondValueUah / liveFx[currency],
      bondReturn: externalInvestmentUah ? (currentBondValueUah - externalInvestmentUah) / externalInvestmentUah : null,
      profit: (currentBondValueUah - currencyValueUah) / liveFx[currency],
      profitPercent: externalInvestmentUah ? (currentBondValueUah - currencyValueUah) / externalInvestmentUah : null,
    };
  });
  const equivalents = baseCurrencies.map(currency => ({
    currency,
    amount: positions.reduce((sum, bond) => sum + toBaseCurrency(bond.principal, bond.currency, currency, liveFx), 0),
  }));
  const capitalByCurrency = baseCurrencies.map(currency => {
    let bondGain = 0;
    let fxImpact = 0;
    for (const bond of positions) {
      const purchaseFx = ratesOnDate(historicalRates, bond.purchaseDate.slice(0, 10), liveFx);
      bondGain += toBaseCurrency(bond.principal - bond.invested, bond.currency, currency, purchaseFx);
      fxImpact += toBaseCurrency(bond.principal, bond.currency, currency, liveFx)
        - toBaseCurrency(bond.principal, bond.currency, currency, purchaseFx);
    }
    const couponIncome = receivedCoupons.reduce((sum, coupon) => {
      const dateFx = ratesOnDate(historicalRates, coupon.paymentDate.slice(0, 10), liveFx);
      return sum + toBaseCurrency(Number(coupon.netAmount), coupon.currency as Currency, currency, dateFx);
    }, 0);
    return { currency, bondGain, fxImpact, couponIncome, couponCount: receivedCoupons.length, profit: couponIncome + bondGain + fxImpact };
  });
  const exposure = baseCurrencies.map(currency => {
    const nativeAmount = positions.filter(bond => bond.currency === currency).reduce((sum, bond) => sum + bond.principal, 0);
    const amount = toBaseCurrency(nativeAmount, currency, "UAH", liveFx);
    const total = equivalents[0].amount;
    return { currency, nativeAmount, amount, share: total ? amount / total : 0 };
  });
  const activeExposure = exposure.filter(item => item.nativeAmount > 0);
  const hasCurrencyMix = activeExposure.length > 1;
  const uah = positions.filter(p => p.currency === "UAH");
  const totalFaceValue = uah.reduce((sum, p) => sum + p.principal, 0);
  const invested = uah.reduce((sum, p) => sum + p.invested, 0);
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
      <section className="stats fx-equivalents"><article className="stat-card"><div className="stat-top"><span>Active face value · UAH</span><span className="stat-icon">₴</span></div><div className="stat-value">{money(equivalents[0].amount)}</div><div className="stat-foot"><span>Converted at live NBU rates</span></div></article>{equivalents.slice(1).map(item => <article className="stat-card" key={item.currency}><div className="stat-top"><span>UAH equivalent · {item.currency}</span><span className="stat-icon">{item.currency === "USD" ? "$" : "€"}</span></div><div className="stat-value">{money(item.amount, item.currency)}</div><div className="stat-foot"><span>Active bond face value</span></div></article>)}</section>
      <article className="panel analytics-fx-panel currency-comparison"><div className="panel-head"><div><h2>Currency vs. bond return</h2><p>How holding USD or EUR compares with holding bonds</p></div></div><div className="fx-breakdown"><div className="fx-breakdown-head"><span>Currency</span><span>Bought and held</span><span>Currency P/L</span><span>Coupons earned*</span><span>Bond value today</span><span>Bond P/L</span><span>Profit<br/>(bond − currency)</span><span>Profit %<br/>(difference)</span></div>{currencyComparison.map(item => <div className="fx-breakdown-row" key={item.currency}><strong>{item.currency}</strong><span>{preciseCurrency(item.unitsBought, item.currency)}<small className="comparison-subvalue">{preciseMoney(item.currencyValueUah)} today</small></span><strong className={item.currencyReturn === null ? "" : item.currencyReturn >= 0 ? "positive" : "negative"}>{percent(item.currencyReturn)}</strong><span>{preciseCurrency(item.couponsInCurrency, item.currency)}</span><span>{preciseCurrency(item.bondValue, item.currency)}</span><strong className={item.bondReturn === null ? "" : item.bondReturn >= 0 ? "positive" : "negative"}>{percent(item.bondReturn)}</strong><strong className={item.profit >= 0 ? "positive" : "negative"}>{preciseCurrency(item.profit, item.currency)}</strong><strong className={item.profitPercent === null ? "" : item.profitPercent >= 0 ? "positive" : "negative"}>{percent(item.profitPercent)}</strong></div>)}</div><p className="fx-note">Profit compares bond P/L with currency P/L: bond value today minus the value of the bought-and-held currency, shown in USD/EUR. Profit % is the difference between Bond P/L and Currency P/L in percentage points. P/L uses external UAH contributions; prior coupons and matured principal fund later purchases instead of being counted twice. Bond value is active face value only. Sold bonds are excluded; coupon receipt is not tracked.</p></article>
      <section className="analytics-fx-grid">
        <article className="panel analytics-fx-panel"><div className="panel-head"><div><h2>Capital gain/loss by currency</h2><p>Active bond face value basis · amounts shown in each row’s currency</p></div></div><div className="fx-breakdown"><div className="fx-breakdown-head"><span>View in</span><span>Bond change</span><span>FX impact</span><span>Coupons</span><span>Received</span><span>Profit*</span></div>{capitalByCurrency.map(item => <div className="fx-breakdown-row" key={item.currency}><strong>{item.currency}</strong><span>{preciseCurrency(item.bondGain, item.currency)}</span><span>{preciseCurrency(item.fxImpact, item.currency)}</span><span>{item.couponCount}</span><span>{preciseCurrency(item.couponIncome, item.currency)}</span><strong className={item.profit >= 0 ? "positive" : "negative"}>{preciseCurrency(item.profit, item.currency)}</strong></div>)}</div><p className="fx-note">* Profit = bond change + FX impact + coupons received. Coupon count includes non-cancelled coupons dated through today for active, matured, and redeemed bonds; sold bonds are excluded. Actual receipt isn’t tracked. FX conversions use NBU rates on or before purchase/payment dates, then live rates if history is unavailable.</p></article>
        {hasCurrencyMix && <article className="panel analytics-fx-panel"><div className="panel-head"><div><h2>Currency exposure</h2><p>Active principal at live NBU rates</p></div></div><div className="fx-exposure-list">{activeExposure.map(item => <div className="fx-exposure-row" key={item.currency}><div className="fx-exposure-label"><strong>{item.currency}</strong><span>{money(item.nativeAmount, item.currency)} · {money(item.amount)} · {percent(item.share)}</span></div><div className="coupon-income-track"><i style={{ width: `${item.share * 100}%` }}/></div></div>)}</div></article>}
      </section>
      <section className="overview-grid analytics-overview"><CashflowChart coupons={coupons} rates={liveFx}/><article className="panel allocation analytics-allocation"><div className="panel-head"><div><h2>Maturity ladder · UAH</h2><p>UAH principal by time to maturity</p></div></div>{uah.length ? <div className="maturity-ladder">{ladder.map(bucket => <div className="maturity-bucket" key={bucket.label}><div className="maturity-bucket-head"><strong>{bucket.label}</strong><span>{bucket.bonds.length} {bucket.bonds.length === 1 ? "bond" : "bonds"}</span></div>{Object.entries(bucket.amounts).map(([currency, amount]) => <div className="maturity-value" key={currency}><div className="maturity-value-label"><span>{currency}</span><strong>{money(amount, currency)}</strong></div><div className="maturity-track"><i style={{ width: `${amount / currencyMax[currency as "UAH"] * 100}%` }}/></div></div>)}</div>)}</div> : <div className="analytics-empty">Add active UAH bonds to see maturity distribution.</div>}</article></section>
      <section className="panel analytics-upcoming"><div className="panel-head"><div><h2>Upcoming UAH coupons</h2><p>Scheduled payments in the next 3 months · after tax</p></div></div>{nextThreeMonths.length ? nextThreeMonths.map(c => <div className="coupon-item" key={c.id}><div className="calendar-tile"><b>{new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(`${c.paymentDate.slice(0, 10)}T00:00:00Z`)).toUpperCase()}</b><strong>{c.paymentDate.slice(8, 10)}</strong></div><div className="coupon-detail"><strong>{c.bondName}</strong><span>{c.isin} · {date(c.paymentDate)}</span></div><strong className="coupon-amount">{money(Number(c.netAmount))}</strong></div>) : <div className="analytics-empty">No UAH coupons scheduled in the next 3 months.</div>}</section>
    </>}
  </>;
}
