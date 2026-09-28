"use client";

import { useEffect, useState } from "react";

type LiveBond = { isin: string; maturity: string; termMaturity: string; quotationDate: string; currency: string; yieldType: string; sellYield: number; sellPrice: number | null; military: boolean };
const price = (value: number, currency: string) => new Intl.NumberFormat("uk-UA", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export default function LivePricesTab() {
  const [bonds, setBonds] = useState<LiveBond[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/live-prices").then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load live prices");
      setBonds(body.data.data);
      setFetchedAt(body.fetchedAt);
      setStale(body.stale);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Could not load live prices")).finally(() => setLoading(false));
  }, []);

  const availableBonds = bonds.filter(bond => bond.currency === "UAH" && typeof bond.sellPrice === "number" && Number.isFinite(bond.sellPrice));

  return <>
    <div className="welcome-row"><div><div className="eyebrow">MARKET DATA</div><h1>Live <span>prices.</span></h1><p className="subhead">Bond prices and yields from Privat24.</p></div></div>
    <section className="panel bonds-panel">
      <div className="bonds-toolbar"><div><h2>Government bonds <span>{availableBonds.length}</span></h2><p>{fetchedAt ? `${stale ? "Cached snapshot · refresh failed · " : "Updated "}${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fetchedAt))}` : "Prices refresh every 3 hours"}</p></div></div>
      {error ? <div className="bond-state" role="alert">{error}</div> : loading ? <div className="bond-state">Loading live prices…</div> : !availableBonds.length ? <div className="bond-state">No UAH bond prices available.</div> : <div className="bond-table-wrap"><table className="bond-table"><thead><tr><th>ISIN</th><th>Type</th><th>Maturity</th><th>Term</th><th>Quotation date</th><th>Price</th><th>Yield</th></tr></thead><tbody>{availableBonds.map(bond => <tr key={bond.isin}><td><strong>{bond.isin}</strong></td><td>{bond.military ? "Military" : "Government"}</td><td>{bond.maturity}</td><td>{bond.termMaturity}</td><td>{bond.quotationDate}</td><td>{price(bond.sellPrice!, bond.currency)}</td><td>{bond.sellYield}%</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
