"use client";

import { useEffect, useState } from "react";

type Coupon = { id: string; bondName: string; isin: string; currency: string; paymentDate: string; grossAmount: string; taxAmount: string; netAmount: string; status: "PAID" | "SCHEDULED" };
const money = (value: string, currency: string) => new Intl.NumberFormat("uk-UA", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));

export default function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/coupons").then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load coupons");
      setCoupons(body);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Could not load coupons")).finally(() => setLoading(false));
  }, []);

  const upcoming = coupons.filter(coupon => coupon.status === "SCHEDULED");
  const next = upcoming[0];
  return <>
    <div className="welcome-row"><div><div className="eyebrow">YOUR PORTFOLIO</div><h1>Coupon <span>schedule.</span></h1><p className="subhead">Upcoming and paid interest payments from your bonds.</p></div></div>
    <section className="bond-summary">
      <article className="panel bond-summary-card"><span>Upcoming payments</span><strong>{upcoming.length}</strong><small>Scheduled coupons</small></article>
      <article className="panel bond-summary-card"><span>Next payment</span><strong>{next ? money(next.netAmount, next.currency) : "—"}</strong><small>{next ? date(next.paymentDate) : "No upcoming payments"}</small></article>
    </section>
    <section className="panel bonds-panel">
      <div className="bonds-toolbar"><div><h2>All coupons <span>{coupons.length}</span></h2><p>Payments across your bond portfolio</p></div></div>
      {error ? <div className="bond-state" role="alert">{error}</div> : loading ? <div className="bond-state">Loading coupons…</div> : !coupons.length ? <div className="bond-state"><strong>No coupons scheduled</strong><span>Add bonds with coupon terms to see payments here.</span></div> : <div className="bond-table-wrap"><table className="bond-table"><thead><tr><th>Payment date</th><th>Bond / ISIN</th><th>Status</th><th>Gross amount</th><th>Tax</th><th>Net amount</th></tr></thead><tbody>{coupons.map(coupon => <tr key={coupon.id}><td>{date(coupon.paymentDate)}</td><td><strong>{coupon.bondName}</strong><small>{coupon.isin}</small></td><td><span className={`status-pill status-${coupon.status.toLowerCase()}`}>{coupon.status === "PAID" ? "Paid" : "Scheduled"}</span></td><td>{money(coupon.grossAmount, coupon.currency)}</td><td>{money(coupon.taxAmount, coupon.currency)}</td><td><strong>{money(coupon.netAmount, coupon.currency)}</strong></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
