"use client";

import { SubmitEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bond, BondInput, bondStatuses, couponFrequencies, currencies, dayCountConventions } from "@/lib/bond-types";

const blankBond = (): BondInput => ({
  isin: "", name: "", status: "ACTIVE", faceValue: "1000.00", quantity: "1", purchasePrice: "1000.00",
  currency: "UAH", usdUahRate: "0.00", eurUahRate: "0.00", interestRate: "", taxRate: "0.00", purchaseDate: "", maturityDate: "", firstCouponDate: "",
  couponFrequency: "SEMIANNUAL", dayCountConvention: "ACT/365", fixedCoupon: "0.00",
});

const label = (value: string) => value.split("_").map(part => part[0] + part.slice(1).toLowerCase()).join(" ");
const amount = (value: string, currency: string) => new Intl.NumberFormat("uk-UA", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
const fixed2 = (value: string | number) => value === "" ? "" : Number(value).toFixed(2);
const couponPayment = (value: string, currency: string) => currency === "UAH"
  ? `${Number(value).toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} грн`
  : amount(value, currency);
const displayDate = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
const percentage = (value: string) => `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const exchangeRate = (value: number) => `₴${value.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pageSize = 30;
type LiveRates = { USD?: { rate: number }; EUR?: { rate: number } };

export default function BondsTab() {
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<BondInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [liveRates, setLiveRates] = useState<LiveRates | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/bonds");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load bonds");
      setBonds(body);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load bonds");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/exchange-rates", { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(setLiveRates)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const displayRate = (saved: string, currency: "USD" | "EUR") => {
    const rate = Number(saved) || liveRates?.[currency]?.rate;
    return rate ? exchangeRate(rate) : "—";
  };

  const statusBonds = useMemo(() => bonds.filter(bond => status === "ALL" || bond.status === status), [bonds, status]);
  const visibleBonds = useMemo(() => statusBonds.filter(bond =>
    `${bond.name} ${bond.isin}`.toLowerCase().includes(search.toLowerCase().trim())), [statusBonds, search]);
  const pageCount = Math.ceil(visibleBonds.length / pageSize);
  const currentPage = Math.min(page, Math.max(1, pageCount));
  const pageBonds = visibleBonds.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalQuantity = statusBonds.reduce((sum, bond) => sum + bond.quantity, 0);
  const statusLabel = status === "ALL" ? "All" : label(status);

  function openForm(bond?: Bond) {
    setEditingId(bond?.id ?? null);
    setForm(bond ? { ...bond, faceValue: fixed2(bond.faceValue), quantity: String(bond.quantity), purchasePrice: fixed2(bond.purchasePrice), usdUahRate: fixed2(bond.usdUahRate), eurUahRate: fixed2(bond.eurUahRate), interestRate: fixed2(bond.interestRate), taxRate: fixed2(bond.taxRate), fixedCoupon: fixed2(bond.fixedCoupon), purchaseDate: bond.purchaseDate.slice(0, 10), maturityDate: bond.maturityDate.slice(0, 10), firstCouponDate: bond.firstCouponDate.slice(0, 10) } : blankBond());
  }

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/bonds/${editingId}` : "/api/bonds", {
        method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save bond");
      setForm(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save bond");
    } finally { setSaving(false); }
  }

  async function remove(bond: Bond) {
    if (!window.confirm(`Remove ${bond.name} (${bond.isin})?`)) return;
    try {
      const response = await fetch(`/api/bonds/${bond.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove bond");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove bond"); }
  }

  const update = (key: keyof BondInput, value: string | boolean) => setForm(current => current && { ...current, [key]: value });

  return <>
    <div className="welcome-row bonds-welcome"><div><div className="eyebrow">YOUR PORTFOLIO</div><h1>Bond <span>holdings.</span></h1><p className="subhead">Manage your Ukrainian government bond positions.</p></div><button className="button primary add-bond" onClick={() => openForm()}><span>＋</span> Add bond</button></div>
    <section className="bond-summary">
      <article className="panel bond-summary-card"><span>Total quantity</span><strong>{totalQuantity.toLocaleString("en-US")}</strong><small>Individual bonds held</small></article>
      <article className="panel bond-summary-card"><span>{statusLabel} bonds</span><strong>{statusBonds.length.toLocaleString("en-US")}</strong><small>Bond positions</small></article>
    </section>
    <section className="panel bonds-panel">
      <div className="bonds-toolbar"><div><h2>{statusLabel} bonds <span>{statusBonds.length}</span></h2><p>Your saved bond details and coupon terms</p></div><div className="bond-filters"><label className="bond-search"><span>⌕</span><input aria-label="Search bonds" placeholder="Search by name or ISIN" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}/></label><select aria-label="Filter by status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="ALL">All statuses</option>{bondStatuses.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></div></div>
      {error && <div className="bond-alert" role="alert"><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="bond-state">Loading bonds…</div> : visibleBonds.length === 0 ? <div className="bond-state"><div className="empty-icon">₴</div><strong>{bonds.length ? "No bonds match your filters" : "No bonds added yet"}</strong><span>{bonds.length ? "Try changing the search or status filter." : "Add your first bond to start tracking your holdings."}</span>{!bonds.length && <button className="button primary" onClick={() => openForm()}>＋ Add your first bond</button>}</div> : <div className="bond-table-wrap"><table className="bond-table"><thead><tr><th>ISIN</th><th>Status</th><th>Face value</th><th>Quantity</th><th>Purchase price</th><th>Interest rate</th><th>Purchase date</th><th>USD / UAH</th><th>EUR / UAH</th><th>Maturity</th><th>Coupon payment</th><th/></tr></thead><tbody>{pageBonds.map(bond => <tr key={bond.id}><td><strong>{bond.isin}</strong></td><td><span className={`status-pill status-${bond.status.toLowerCase()}`}>{label(bond.status)}</span></td><td>{amount(bond.faceValue, bond.currency)}</td><td>{bond.quantity.toLocaleString("en-US")}</td><td>{amount(bond.purchasePrice, bond.currency)}</td><td>{percentage(String(bond.interestRate))}</td><td>{displayDate(bond.purchaseDate)}</td><td title={Number(bond.usdUahRate) ? "Manual rate" : "Live NBU rate"}>{displayRate(String(bond.usdUahRate), "USD")}</td><td title={Number(bond.eurUahRate) ? "Manual rate" : "Live NBU rate"}>{displayRate(String(bond.eurUahRate), "EUR")}</td><td>{displayDate(bond.maturityDate)}</td><td>{couponPayment(String(bond.fixedCoupon), bond.currency)}</td><td><div className="bond-actions"><button aria-label={`Edit ${bond.name}`} title="Edit" onClick={() => openForm(bond)}>✎</button><button aria-label={`Remove ${bond.name}`} title="Remove" onClick={() => void remove(bond)}>×</button></div></td></tr>)}</tbody></table></div>}
      {!loading && visibleBonds.length > 0 && <div className="bond-table-footer"><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleBonds.length)} of {visibleBonds.length} positions · amounts shown in each bond’s currency</span>{pageCount > 1 && <div className="pagination"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div>}</div>}
    </section>
    {form && <div className="bond-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setForm(null); }}><section className="bond-modal" role="dialog" aria-modal="true" aria-labelledby="bond-form-title"><div className="bond-modal-head"><div><div className="eyebrow">BOND DETAILS</div><h2 id="bond-form-title">{editingId ? "Edit bond" : "Add a bond"}</h2><p>Enter the bond’s instrument and coupon information.</p></div><button className="modal-close" aria-label="Close" onClick={() => setForm(null)}>×</button></div><form onSubmit={save}><div className="bond-form-grid">
      <label className="form-field"><span>ISIN</span><input required maxLength={12} minLength={12} pattern="[A-Z]{2}[A-Z0-9]{9}[0-9]" title="Enter a 12-character ISIN in uppercase" value={form.isin} onChange={event => update("isin", event.target.value.toUpperCase())} placeholder="UA4000231281"/></label>
      <label className="form-field"><span>Name</span><input required maxLength={120} value={form.name} onChange={event => update("name", event.target.value)} placeholder="e.g. Ukraine 2027"/></label>
      <label className="form-field"><span>Status</span><select value={form.status} onChange={event => update("status", event.target.value)}>{bondStatuses.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <label className="form-field"><span>Face value</span><input required type="number" min="0.01" step="0.01" value={form.faceValue} onChange={event => update("faceValue", event.target.value)} onBlur={event => update("faceValue", fixed2(event.currentTarget.value))}/></label>
      <label className="form-field"><span>Quantity</span><input required type="number" min="1" step="1" value={form.quantity} onChange={event => update("quantity", event.target.value)}/></label>
      <label className="form-field"><span>Purchase price <small>per bond</small></span><input required type="number" min="0" step="0.01" value={form.purchasePrice} onChange={event => update("purchasePrice", event.target.value)} onBlur={event => update("purchasePrice", fixed2(event.currentTarget.value))}/></label>
      <label className="form-field"><span>Currency</span><select value={form.currency} onChange={event => update("currency", event.target.value)}>{currencies.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="form-field"><span>USD → UAH rate <small>0 = live NBU rate</small></span><input required type="number" min="0" step="0.01" value={form.usdUahRate} onChange={event => update("usdUahRate", event.target.value)} onBlur={event => update("usdUahRate", fixed2(event.currentTarget.value))}/></label>
      <label className="form-field"><span>EUR → UAH rate <small>0 = live NBU rate</small></span><input required type="number" min="0" step="0.01" value={form.eurUahRate} onChange={event => update("eurUahRate", event.target.value)} onBlur={event => update("eurUahRate", fixed2(event.currentTarget.value))}/></label>
      <label className="form-field"><span>Interest rate (%)</span><input required type="number" min="0" step="0.01" value={form.interestRate} onChange={event => update("interestRate", event.target.value)} onBlur={event => update("interestRate", fixed2(event.currentTarget.value))}/></label>
      <label className="form-field"><span>Tax rate (%)</span><input required type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={event => update("taxRate", event.target.value)} onBlur={event => update("taxRate", fixed2(event.currentTarget.value))}/></label>
      <label className="form-field"><span>Purchase date</span><input required type="date" value={form.purchaseDate} onChange={event => update("purchaseDate", event.target.value)}/></label>
      <label className="form-field"><span>Maturity date</span><input required type="date" min={form.purchaseDate} value={form.maturityDate} onChange={event => update("maturityDate", event.target.value)}/></label>
      <label className="form-field"><span>First coupon date</span><input required type="date" value={form.firstCouponDate} onChange={event => update("firstCouponDate", event.target.value)}/></label>
      <label className="form-field"><span>Coupon frequency</span><select value={form.couponFrequency} onChange={event => update("couponFrequency", event.target.value)}>{couponFrequencies.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <label className="form-field"><span>Day count convention</span><select value={form.dayCountConvention} onChange={event => update("dayCountConvention", event.target.value)}>{dayCountConventions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="form-field"><span>Coupon payment <small>per bond</small></span><input required type="number" min="0" step="0.01" value={form.fixedCoupon} onChange={event => update("fixedCoupon", event.target.value)} onBlur={event => update("fixedCoupon", fixed2(event.currentTarget.value))}/></label>
      </div><div className="bond-form-actions"><button type="button" className="button" onClick={() => setForm(null)} disabled={saving}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add bond"}</button></div></form></section></div>}
  </>;
}
