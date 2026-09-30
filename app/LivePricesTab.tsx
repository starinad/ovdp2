"use client";

import { Fragment, useEffect, useState } from "react";

type Coupon = { type: string; value: number; paymentDate: string };
type LiveBond = {
  isin: string;
  maturity: string;
  termMaturity: string;
  currency: string;
  sellYield: number;
  sellPrice: number;
  military: boolean;
  coupons: Coupon[];
};

const price = (value: number, currency: string) => new Intl.NumberFormat("uk-UA", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
type SortKey = "maturity" | "sellPrice" | "sellYield";
export default function LivePricesTab() {
  const [bonds, setBonds] = useState<LiveBond[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedIsin, setExpandedIsin] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "maturity", direction: 1 });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("live-prices-preferences") || "{}");
      if (Number.isSafeInteger(saved.quantity) && saved.quantity > 0) setQuantity(saved.quantity);
      if (["maturity", "sellPrice", "sellYield"].includes(saved.sort?.key) && [1, -1].includes(saved.sort?.direction)) setSort(saved.sort);
    } catch {}
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (preferencesLoaded) {
      try { localStorage.setItem("live-prices-preferences", JSON.stringify({ quantity, sort })); } catch {}
    }
  }, [preferencesLoaded, quantity, sort]);

  useEffect(() => {
    fetch("/api/live-prices").then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load live prices");
      setBonds(body.data.data);
      setFetchedAt(body.fetchedAt);
      setStale(body.stale);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Could not load live prices")).finally(() => setLoading(false));
  }, []);

  const sortedBonds = [...bonds].sort((a, b) => {
    const value = (bond: LiveBond) => sort.key === "maturity"
      ? new Date(bond.maturity.split(".").reverse().join("-")).getTime()
      : bond[sort.key];
    return (value(a) - value(b)) * sort.direction;
  });
  const sortBy = (key: SortKey) => setSort(current => ({ key, direction: current.key === key ? current.direction === 1 ? -1 : 1 : 1 }));

  return <>
    <div className="welcome-row"><div><div className="eyebrow">MARKET DATA</div><h1>Live <span>prices.</span></h1><p className="subhead">Bond prices and yields from Privat24.</p></div></div>
    <section className="panel bonds-panel">
      <div className="bonds-toolbar"><div><h2>Government bonds <span>{bonds.length}</span></h2><p>{fetchedAt ? `${stale ? "Cached snapshot · refresh failed · " : "Updated "}${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fetchedAt))}` : "Prices refresh every 3 hours"}</p></div><label className="quantity-field">Quantity <input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /></label></div>
      {error ? <div className="bond-state" role="alert">{error}</div> : loading ? <div className="bond-state">Loading live prices…</div> : !bonds.length ? <div className="bond-state">No UAH bond prices available.</div> : <div className="bond-table-wrap"><table className="bond-table"><thead><tr><th>ISIN</th><th>Type</th><th><button className="table-sort" onClick={() => sortBy("maturity")}>Maturity {sort.key === "maturity" ? sort.direction === 1 ? "↑" : "↓" : "↕"}</button></th><th>Term</th><th><button className="table-sort" onClick={() => sortBy("sellPrice")}>Price {sort.key === "sellPrice" ? sort.direction === 1 ? "↑" : "↓" : "↕"}</button></th><th><button className="table-sort" onClick={() => sortBy("sellYield")}>Yield {sort.key === "sellYield" ? sort.direction === 1 ? "↑" : "↓" : "↕"}</button></th><th>Buy Cost</th><th>Loss</th><th>Profit</th><th>Percent Yield</th></tr></thead><tbody>
        {sortedBonds.map(bond => <Fragment key={bond.isin}>
          <tr className="live-bond-row" tabIndex={0} role="button" aria-expanded={expandedIsin === bond.isin} aria-controls={`coupons-${bond.isin}`} onClick={() => setExpandedIsin(expandedIsin === bond.isin ? null : bond.isin)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedIsin(expandedIsin === bond.isin ? null : bond.isin); } }}>
            <td><strong>{bond.isin}</strong></td><td>{bond.military ? "Military" : "Government"}</td><td>{bond.maturity}</td><td>{bond.termMaturity}</td><td>{price(bond.sellPrice, bond.currency)}</td><td>{bond.sellYield}%</td><td>{price(bond.sellPrice * quantity, bond.currency)}</td><td className="loss-value">{price(((bond.coupons?.find(coupon => coupon.type === "Погашення")?.value ?? 0) - bond.sellPrice) * quantity, bond.currency)}</td><td className="profit-value">{price(((bond.coupons ?? []).reduce((sum, coupon) => sum + coupon.value, 0) - bond.sellPrice) * quantity, bond.currency)}</td><td>{bond.sellPrice ? `${(((bond.coupons ?? []).reduce((sum, coupon) => sum + coupon.value, 0) - bond.sellPrice) / bond.sellPrice * 100).toFixed(2)}%` : "—"}</td>
          </tr>
          {expandedIsin === bond.isin && <tr><td colSpan={10} className="live-coupon-cell"><div id={`coupons-${bond.isin}`}><strong>Coupon schedule · quantity {quantity}</strong>{bond.coupons?.length ? <div className="live-coupon-list">{bond.coupons.map(coupon => <div className="live-coupon-row" key={`${coupon.paymentDate}-${coupon.type}`}><span>{coupon.type}</span><span>{coupon.paymentDate}</span><strong>{price(coupon.value * quantity, bond.currency)}</strong></div>)}</div> : <p>No coupons available.</p>}</div></td></tr>}
        </Fragment>)}
      </tbody></table></div>}
    </section>
  </>;
}
