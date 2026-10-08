"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type Coupon = { paymentDate: string; grossAmount: number; taxAmount: number; netAmount: number; status: string };
type PortfolioCoupon = Coupon & { bondName: string; isin: string };
type Bond = { id: string; isin: string; name: string; status: string; faceValue: number; quantity: number; currency: string; maturityDate: string };
type LiveBond = { isin: string; maturity: string; termMaturity: string; currency: string; sellPrice: number | null; sellYield: number; coupons?: { type: string; paymentDate: string; value: number }[] };
type CashMonth = { month: string; gross: number; tax: number; net: number; maturity: number; invest: number | null; totalNet: number; simulatedNet: number; simulatedMaturity: number; coupons: number; maturities: number };

const money = (value: number) => new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: 2 }).format(value);
const monthOf = (date: string) => date.slice(0, 7);
const parseDMY = (value: string) => {
  const [day, month, year] = value.split(".").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

export default function CashflowTab() {
  const [mode, setMode] = useState<"ALL" | "PAST" | "FUTURE">("FUTURE");
  const [coupons, setCoupons] = useState<PortfolioCoupon[]>([]);
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [liveBonds, setLiveBonds] = useState<LiveBond[]>([]);
  const [monthlyInvestment, setMonthlyInvestment] = useState(0);
  const [monthlyInvestmentCurrency, setMonthlyInvestmentCurrency] = useState<"UAH" | "USD">("UAH");
  const [usdRate, setUsdRate] = useState<number | null>(null);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, string>>({});
  const [includedBonds, setIncludedBonds] = useState<Record<string, boolean>>({});
  const [quantitiesLoaded, setQuantitiesLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/config").then(response => response.ok ? response.json() : null).then(config => {
      if (!config) return;
      setMonthlyInvestment(Number(config.monthlyInvestment) || 0);
      setMonthlyInvestmentCurrency(config.monthlyInvestmentCurrency === "USD" ? "USD" : "UAH");
    }).catch(() => {});
    fetch("/api/exchange-rates").then(response => response.ok ? response.json() : null).then(rates => {
      if (Number.isFinite(rates?.USD?.rate)) setUsdRate(rates.USD.rate);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cashflow-quantities") || "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) setBuyQuantities(saved);
      const savedIncluded = JSON.parse(localStorage.getItem("cashflow-included-bonds") || "{}");
      if (savedIncluded && typeof savedIncluded === "object" && !Array.isArray(savedIncluded)) setIncludedBonds(savedIncluded);
    } catch {}
    setQuantitiesLoaded(true);
  }, []);

  useEffect(() => {
    if (quantitiesLoaded) {
      try { localStorage.setItem("cashflow-quantities", JSON.stringify(buyQuantities)); } catch {}
      try { localStorage.setItem("cashflow-included-bonds", JSON.stringify(includedBonds)); } catch {}
    }
  }, [buyQuantities, includedBonds, quantitiesLoaded]);

  useEffect(() => {
    Promise.all([fetch("/api/coupons"), fetch("/api/bonds"), fetch("/api/live-prices")])
      .then(async ([couponResponse, bondResponse, liveResponse]) => {
        const [couponData, bondData, liveData] = await Promise.all([couponResponse.json(), bondResponse.json(), liveResponse.json()]);
        for (const [response, data] of [[couponResponse, couponData], [bondResponse, bondData]] as const) {
          if (!response.ok) throw new Error(data.error || "Could not load cashflow data");
        }
        setCoupons(couponData);
        setBonds(bondData);
        setLiveBonds(liveResponse.ok ? liveData.data.data : []);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Could not load cashflow"))
      .finally(() => setLoading(false));
  }, []);

  const months = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<string, CashMonth>();
    const getMonth = (month: string) => {
      if (!map.has(month)) map.set(month, { month, gross: 0, tax: 0, net: 0, maturity: 0, invest: 0, totalNet: 0, simulatedNet: 0, simulatedMaturity: 0, coupons: 0, maturities: 0 });
      return map.get(month)!;
    };
    const visible = (value: string) => mode === "ALL" || (mode === "FUTURE" ? new Date(`${value.slice(0, 10)}T00:00:00`) >= today : new Date(`${value.slice(0, 10)}T00:00:00`) < today);

    for (const coupon of coupons) {
      const date = coupon.paymentDate.slice(0, 10);
      if (coupon.status === "CANCELLED" || !visible(date)) continue;
      const row = getMonth(monthOf(date));
      row.gross += Number(coupon.grossAmount) || 0;
      row.tax += Number(coupon.taxAmount) || 0;
      row.net += Number(coupon.netAmount) || 0;
      row.coupons++;
    }
    for (const bond of bonds) {
      const date = bond.maturityDate.slice(0, 10);
      if (["SOLD", "REDEEMED"].includes(bond.status) || !visible(date)) continue;
      const row = getMonth(monthOf(date));
      row.maturity += Number(bond.faceValue) * Number(bond.quantity);
      row.maturities++;
    }
    for (const bond of liveBonds) {
      const quantity = includedBonds[bond.isin] === false ? 0 : Number(buyQuantities[bond.isin]) || 0;
      if (!quantity) continue;
      for (const coupon of bond.coupons ?? []) {
        const date = parseDMY(coupon.paymentDate);
        if (!date) continue;
        const dateValue = date.toLocaleDateString("sv-SE");
        if (!visible(dateValue)) continue;
        const row = getMonth(monthOf(dateValue));
        if (coupon.type === "Погашення") row.simulatedMaturity += Number(coupon.value) * quantity;
        else row.simulatedNet += Number(coupon.value) * quantity;
      }
    }
    if (mode === "FUTURE") getMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
    const monthIndex = (month: string) => {
      const [year, number] = month.split("-").map(Number);
      return year * 12 + number - 1;
    };
    const existingMonths = [...map.keys()];
    if (existingMonths.length) {
      const first = Math.min(...existingMonths.map(monthIndex));
      const last = Math.max(...existingMonths.map(monthIndex));
      for (let index = first; index <= last; index++) {
        getMonth(`${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`);
      }
    }
    const monthlyInvestUah = monthlyInvestmentCurrency === "UAH" ? monthlyInvestment : usdRate === null ? null : monthlyInvestment * usdRate;
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).map(row => {
      const totalNet = row.net + row.maturity;
      const invest = monthlyInvestUah === null ? null : Math.floor(monthlyInvestUah / 1000) * 1000 + Math.floor(totalNet / 1000) * 1000;
      return { ...row, invest, totalNet };
    });
  }, [bonds, buyQuantities, coupons, includedBonds, liveBonds, mode, monthlyInvestment, monthlyInvestmentCurrency, usdRate]);

  useEffect(() => {
    if (!months.some(row => row.month === selectedMonth)) setSelectedMonth(months[0]?.month || "");
  }, [months, selectedMonth]);

  const selectedLiveBonds = liveBonds.filter(bond => bond.currency === "UAH" && bond.coupons?.some(coupon => coupon.type !== "Погашення" && parseDMY(coupon.paymentDate)?.toLocaleDateString("sv-SE").slice(0, 7) === selectedMonth)).sort((a, b) => {
    const date = (value: string) => parseDMY(value)?.getTime() || 0;
    return date(a.maturity) - date(b.maturity);
  });
  const totals = months.reduce((sum, row) => ({ gross: sum.gross + row.gross, tax: sum.tax + row.tax, net: sum.net + row.net, maturity: sum.maturity + row.maturity, invest: sum.invest === null || row.invest === null ? null : sum.invest + row.invest, totalNet: sum.totalNet + row.totalNet, simulatedNet: sum.simulatedNet + row.simulatedNet, simulatedMaturity: sum.simulatedMaturity + row.simulatedMaturity, coupons: sum.coupons + row.coupons, maturities: sum.maturities + row.maturities }), { gross: 0, tax: 0, net: 0, maturity: 0, invest: 0 as number | null, totalNet: 0, simulatedNet: 0, simulatedMaturity: 0, coupons: 0, maturities: 0 });
  const showInvestment = monthlyInvestment !== 0;
  const heatFill = (value: number, simulated: number, max: number) => {
    const currentWidth = max ? value / max * 100 : 0;
    const simulatedWidth = max ? simulated / max * 100 : 0;
    return `linear-gradient(90deg, var(--heat-fill) ${currentWidth}%, #ad480d ${currentWidth}% ${currentWidth + simulatedWidth}%, transparent ${currentWidth + simulatedWidth}%)`;
  };
  const maxNet = Math.max(0, ...months.map(item => item.net + item.simulatedNet));
  const maxTotalNet = Math.max(0, ...months.map(item => item.totalNet + item.simulatedNet + item.simulatedMaturity));

  return <>
    <div className="welcome-row"><div><div className="eyebrow">PORTFOLIO</div><h1>Cashflow <span>schedule.</span></h1><p className="subhead">Monthly coupon income and bond maturities.</p></div></div>
    <section className="bond-summary cashflow-summary">
      <article className="panel bond-summary-card"><span>Maturities</span><strong>{money(totals.maturity)}</strong><small>Total principal repayments</small></article>
      <article className="panel bond-summary-card"><span>Net coupon income</span><strong>{money(totals.net)}</strong><small>After tax</small></article>
      <article className="panel bond-summary-card"><span>Total net cashflow</span><strong>{money(totals.totalNet)}</strong><small>Coupons and maturities</small></article>
    </section>
    <section className="panel cashflow-panel">
      <div className="bonds-toolbar cashflow-toolbar"><div><h2>Monthly cashflow</h2><p>Select a month to see matching live bonds</p></div><div className="bond-filters"><select aria-label="Cashflow period" value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="ALL">All</option><option value="PAST">Past</option><option value="FUTURE">Future</option></select></div></div>
      {error ? <div className="bond-state" role="alert">{error}</div> : loading ? <div className="bond-state">Loading cashflow…</div> : !months.length ? <div className="bond-state">No cashflows for this period.</div> : <div className="bond-table-wrap"><table className="bond-table cashflow-table"><thead><tr><th>Month</th><th>Gross coupons</th><th>Tax</th><th>Net coupon income</th><th>Maturities</th><th>Total gross cashflow</th><th>Total net cashflow</th><th>Coupons</th><th>Maturities</th>{showInvestment && <th>Invest</th>}</tr></thead><tbody>
        <tr className="cashflow-total"><th>Total</th><th>{money(totals.gross)}</th><th>{money(totals.tax)}</th><th>{money(totals.net)}{totals.simulatedNet > 0 && <span className="cashflow-simulated-value"> + {money(totals.simulatedNet)}</span>}</th><th>{money(totals.maturity)}</th><th>{money(totals.gross + totals.maturity)}</th><th>{money(totals.totalNet)}{totals.simulatedNet + totals.simulatedMaturity > 0 && <span className="cashflow-simulated-value"> + {money(totals.simulatedNet + totals.simulatedMaturity)}</span>}</th><th>{totals.coupons}</th><th>{totals.maturities}</th>{showInvestment && <th>{totals.invest === null ? "—" : money(totals.invest)}</th>}</tr>
        {months.map(row => <Fragment key={row.month}><tr className={selectedMonth === row.month ? "cashflow-row selected" : "cashflow-row"} tabIndex={0} aria-expanded={expandedMonth === row.month} onClick={() => { setSelectedMonth(row.month); setExpandedMonth(expandedMonth === row.month ? null : row.month); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMonth(row.month); setExpandedMonth(expandedMonth === row.month ? null : row.month); } }}>
          <td><strong>{new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${row.month}-01T00:00:00Z`))}</strong></td><td>{money(row.gross)}</td><td>{money(row.tax)}</td><td style={{ background: heatFill(row.net, row.simulatedNet, maxNet), color: "var(--heat-text)", fontWeight: 700 }}>{money(row.net)}{row.simulatedNet > 0 && <span className="cashflow-simulated-value"> + {money(row.simulatedNet)}</span>}</td><td>{money(row.maturity)}</td><td>{money(row.gross + row.maturity)}</td><td style={{ background: heatFill(row.totalNet, row.simulatedNet + row.simulatedMaturity, maxTotalNet), color: "var(--heat-text)", fontWeight: 700 }}><strong>{money(row.totalNet)}{row.simulatedNet + row.simulatedMaturity > 0 && <span className="cashflow-simulated-value"> + {money(row.simulatedNet + row.simulatedMaturity)}</span>}</strong></td><td>{row.coupons}</td><td>{row.maturities}</td>{showInvestment && <td>{row.invest === null ? "—" : money(row.invest)}</td>}
        </tr>{expandedMonth === row.month && <tr className="cashflow-expanded"><td colSpan={showInvestment ? 10 : 9}><div className="cashflow-expanded-content"><div className="panel-head"><div><h2>Live bonds with coupons <span>{selectedLiveBonds.length}</span></h2><p>{row.month} · sorted by maturity</p></div></div>{selectedLiveBonds.length ? <div className="bond-table-wrap"><table className="bond-table cashflow-live-table"><thead><tr><th>ISIN</th><th>Maturity</th><th>Term</th><th>Yield</th><th>Price</th><th>Quantity</th><th>Use</th><th>Buy Cost</th><th>Loss</th><th>Profit</th></tr></thead><tbody>{selectedLiveBonds.map(bond => { const quantity = includedBonds[bond.isin] === false ? 0 : Number(buyQuantities[bond.isin]) || 0; const redemption = bond.coupons?.find(coupon => coupon.type === "Погашення")?.value ?? 0; const couponTotal = (bond.coupons ?? []).reduce((sum, coupon) => sum + Number(coupon.value), 0); return <tr key={bond.isin}><td><strong>{bond.isin}</strong></td><td>{bond.maturity}</td><td>{bond.termMaturity}</td><td>{bond.sellYield}%</td><td>{bond.sellPrice == null ? "—" : money(bond.sellPrice)}</td><td><input className="cashflow-buy-quantity" aria-label={`Quantity for ${bond.isin}`} type="number" min="0" step="1" value={buyQuantities[bond.isin] ?? "0"} onChange={event => setBuyQuantities(current => ({ ...current, [bond.isin]: event.target.value }))} /></td><td><input aria-label={`Include ${bond.isin} in calculations`} type="checkbox" checked={includedBonds[bond.isin] !== false} onChange={event => setIncludedBonds(current => ({ ...current, [bond.isin]: event.target.checked }))} /></td><td>{bond.sellPrice == null ? "—" : money(bond.sellPrice * quantity)}</td><td className="loss-value">{bond.sellPrice == null ? "—" : money((redemption - bond.sellPrice) * quantity)}</td><td className="profit-value">{bond.sellPrice == null ? "—" : money((couponTotal - bond.sellPrice) * quantity)}</td></tr>; })}</tbody></table></div> : <div className="cashflow-empty">No available UAH bonds have coupon payments in this month.</div>}</div></td></tr>}</Fragment>)}
      </tbody></table></div>}
    </section>
  </>;
}
