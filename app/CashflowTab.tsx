"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type Coupon = { paymentDate: string; grossAmount: number; taxAmount: number; netAmount: number; status: string };
type PortfolioCoupon = Coupon & { bondName: string; isin: string };
type Bond = { id: string; isin: string; name: string; status: string; faceValue: number; quantity: number; currency: string; maturityDate: string };
type LiveBond = { isin: string; maturity: string; currency: string; sellPrice: number | null; sellYield: number; coupons?: { type: string; paymentDate: string }[] };
type CashMonth = { month: string; gross: number; tax: number; net: number; maturity: number; totalNet: number; coupons: number; maturities: number };

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
  const [selectedMonth, setSelectedMonth] = useState("");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      if (!map.has(month)) map.set(month, { month, gross: 0, tax: 0, net: 0, maturity: 0, totalNet: 0, coupons: 0, maturities: 0 });
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
    if (mode === "FUTURE") getMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).map(row => ({ ...row, totalNet: row.net + row.maturity }));
  }, [bonds, coupons, mode]);

  useEffect(() => {
    if (!months.some(row => row.month === selectedMonth)) setSelectedMonth(months[0]?.month || "");
  }, [months, selectedMonth]);

  const selectedLiveBonds = liveBonds.filter(bond => bond.currency === "UAH" && bond.coupons?.some(coupon => coupon.type !== "Погашення" && parseDMY(coupon.paymentDate)?.toLocaleDateString("sv-SE").slice(0, 7) === selectedMonth)).sort((a, b) => {
    const date = (value: string) => parseDMY(value)?.getTime() || 0;
    return date(a.maturity) - date(b.maturity);
  });
  const totals = months.reduce((sum, row) => ({ gross: sum.gross + row.gross, tax: sum.tax + row.tax, net: sum.net + row.net, maturity: sum.maturity + row.maturity, totalNet: sum.totalNet + row.totalNet, coupons: sum.coupons + row.coupons, maturities: sum.maturities + row.maturities }), { gross: 0, tax: 0, net: 0, maturity: 0, totalNet: 0, coupons: 0, maturities: 0 });
  const heatColor = (value: number, values: number[]) => {
    const positive = values.filter(item => item > 0);
    const min = Math.min(...positive);
    const max = Math.max(...positive);
    const ratio = value > 0 && max > min ? Math.log(value / min) / Math.log(max / min) : 0;
    return `rgb(${Math.round(244 - ratio * 112)}, ${Math.round(250 - ratio * 49)}, ${Math.round(246 - ratio * 89)})`;
  };

  return <>
    <div className="welcome-row"><div><div className="eyebrow">PORTFOLIO</div><h1>Cashflow <span>schedule.</span></h1><p className="subhead">Monthly coupon income and bond maturities.</p></div></div>
    <section className="panel cashflow-panel">
      <div className="bonds-toolbar cashflow-toolbar"><div><h2>Monthly cashflow</h2><p>Select a month to see matching live bonds</p></div><div className="bond-filters"><select aria-label="Cashflow period" value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="ALL">All</option><option value="PAST">Past</option><option value="FUTURE">Future</option></select></div></div>
      {error ? <div className="bond-state" role="alert">{error}</div> : loading ? <div className="bond-state">Loading cashflow…</div> : !months.length ? <div className="bond-state">No cashflows for this period.</div> : <div className="bond-table-wrap"><table className="bond-table cashflow-table"><thead><tr><th>Month</th><th>Gross coupons</th><th>Tax</th><th>Net coupon income</th><th>Maturities</th><th>Total gross cashflow</th><th>Total net cashflow</th><th>Coupons</th><th>Maturities</th></tr></thead><tbody>
        <tr className="cashflow-total"><th>Total</th><th>{money(totals.gross)}</th><th>{money(totals.tax)}</th><th>{money(totals.net)}</th><th>{money(totals.maturity)}</th><th>{money(totals.gross + totals.maturity)}</th><th>{money(totals.totalNet)}</th><th>{totals.coupons}</th><th>{totals.maturities}</th></tr>
        {months.map(row => <Fragment key={row.month}><tr className={selectedMonth === row.month ? "cashflow-row selected" : "cashflow-row"} tabIndex={0} aria-expanded={expandedMonth === row.month} onClick={() => { setSelectedMonth(row.month); setExpandedMonth(expandedMonth === row.month ? null : row.month); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMonth(row.month); setExpandedMonth(expandedMonth === row.month ? null : row.month); } }}>
          <td><strong>{new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${row.month}-01T00:00:00Z`))}</strong></td><td>{money(row.gross)}</td><td>{money(row.tax)}</td><td style={{ background: heatColor(row.net, months.map(item => item.net)) }}>{money(row.net)}</td><td>{money(row.maturity)}</td><td>{money(row.gross + row.maturity)}</td><td style={{ background: heatColor(row.totalNet, months.map(item => item.totalNet)) }}><strong>{money(row.totalNet)}</strong></td><td>{row.coupons}</td><td>{row.maturities}</td>
        </tr>{expandedMonth === row.month && <tr className="cashflow-expanded"><td colSpan={9}><div className="cashflow-expanded-content"><div className="panel-head"><div><h2>Live bonds with coupons <span>{selectedLiveBonds.length}</span></h2><p>{row.month} · sorted by maturity</p></div></div>{selectedLiveBonds.length ? <div className="bond-table-wrap"><table className="bond-table cashflow-live-table"><thead><tr><th>ISIN</th><th>Maturity</th><th>Yield</th><th>Price</th></tr></thead><tbody>{selectedLiveBonds.map(bond => <tr key={bond.isin}><td><strong>{bond.isin}</strong></td><td>{bond.maturity}</td><td>{bond.sellYield}%</td><td>{bond.sellPrice == null ? "—" : money(bond.sellPrice)}</td></tr>)}</tbody></table></div> : <div className="cashflow-empty">No available UAH bonds have coupon payments in this month.</div>}</div></td></tr>}</Fragment>)}
      </tbody></table></div>}
    </section>
  </>;
}
