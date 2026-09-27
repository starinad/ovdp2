"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bond, BondInput, bondStatuses, couponFrequencies, currencies, dayCountConventions } from "@/lib/bond-types";

const blankBond = (): BondInput => ({
  isin: "", name: "", status: "ACTIVE", faceValue: "1000", quantity: "1", purchasePrice: "1000",
  currency: "UAH", interestRate: "", taxRate: "0", purchaseDate: "", maturityDate: "", firstCouponDate: "",
  couponFrequency: "SEMIANNUAL", dayCountConvention: "ACT/ACT", fixedCoupon: "0",
});

const label = (value: string) => value.split("_").map(part => part[0] + part.slice(1).toLowerCase()).join(" ");
const amount = (value: string, currency: string) => new Intl.NumberFormat("uk-UA", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
const displayDate = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));

export default function BondsTab() {
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [form, setForm] = useState<BondInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const visibleBonds = useMemo(() => bonds.filter(bond =>
    (status === "ALL" || bond.status === status)
    && `${bond.name} ${bond.isin}`.toLowerCase().includes(search.toLowerCase().trim())), [bonds, search, status]);
  const totalQuantity = bonds.reduce((sum, bond) => sum + bond.quantity, 0);

  function openForm(bond?: Bond) {
    setEditingId(bond?.id ?? null);
    setForm(bond ? { ...bond, faceValue: String(bond.faceValue), quantity: String(bond.quantity), purchasePrice: String(bond.purchasePrice), interestRate: String(bond.interestRate), purchaseDate: bond.purchaseDate.slice(0, 10), maturityDate: bond.maturityDate.slice(0, 10), firstCouponDate: bond.firstCouponDate.slice(0, 10) } : blankBond());
  }

  async function save(event: FormEvent<HTMLFormElement>) {
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
      <article className="panel bond-summary-card"><span>Total positions</span><strong>{bonds.length}</strong><small>Bond instruments</small></article>
      <article className="panel bond-summary-card"><span>Total quantity</span><strong>{totalQuantity.toLocaleString("en-US")}</strong><small>Individual bonds held</small></article>
      <article className="panel bond-summary-card"><span>Active bonds</span><strong>{bonds.filter(bond => bond.status === "ACTIVE").length}</strong><small>Currently accruing</small></article>
    </section>
    <section className="panel bonds-panel">
      <div className="bonds-toolbar"><div><h2>All bonds <span>{bonds.length}</span></h2><p>Your saved bond details and coupon terms</p></div><div className="bond-filters"><label className="bond-search"><span>⌕</span><input aria-label="Search bonds" placeholder="Search by name or ISIN" value={search} onChange={event => setSearch(event.target.value)}/></label><select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">All statuses</option>{bondStatuses.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></div></div>
      {error && <div className="bond-alert" role="alert"><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="bond-state">Loading bonds…</div> : visibleBonds.length === 0 ? <div className="bond-state"><div className="empty-icon">₴</div><strong>{bonds.length ? "No bonds match your filters" : "No bonds added yet"}</strong><span>{bonds.length ? "Try changing the search or status filter." : "Add your first bond to start tracking your holdings."}</span>{!bonds.length && <button className="button primary" onClick={() => openForm()}>＋ Add your first bond</button>}</div> : <div className="bond-table-wrap"><table className="bond-table"><thead><tr><th>Bond / ISIN</th><th>Status</th><th>Face value</th><th>Quantity</th><th>Purchase price</th><th>Interest rate</th><th>Purchase date</th><th>Maturity</th><th>Coupon terms</th><th/></tr></thead><tbody>{visibleBonds.map(bond => <tr key={bond.id}><td><strong>{bond.name}</strong><small>{bond.isin}</small></td><td><span className={`status-pill status-${bond.status.toLowerCase()}`}>{label(bond.status)}</span></td><td>{amount(bond.faceValue, bond.currency)}</td><td>{bond.quantity.toLocaleString("en-US")}</td><td>{amount(bond.purchasePrice, bond.currency)}</td><td>{bond.interestRate}%</td><td>{displayDate(bond.purchaseDate)}</td><td>{displayDate(bond.maturityDate)}</td><td><strong>{label(bond.couponFrequency)}</strong><small>{bond.dayCountConvention} · {amount(bond.fixedCoupon, bond.currency)} per payment</small></td><td><div className="bond-actions"><button aria-label={`Edit ${bond.name}`} title="Edit" onClick={() => openForm(bond)}>✎</button><button aria-label={`Remove ${bond.name}`} title="Remove" onClick={() => void remove(bond)}>×</button></div></td></tr>)}</tbody></table></div>}
      {!loading && bonds.length > 0 && <div className="bond-table-footer">Showing {visibleBonds.length} of {bonds.length} positions <span>Amounts shown in each bond’s currency</span></div>}
    </section>
    {form && <div className="bond-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setForm(null); }}><section className="bond-modal" role="dialog" aria-modal="true" aria-labelledby="bond-form-title"><div className="bond-modal-head"><div><div className="eyebrow">BOND DETAILS</div><h2 id="bond-form-title">{editingId ? "Edit bond" : "Add a bond"}</h2><p>Enter the bond’s instrument and coupon information.</p></div><button className="modal-close" aria-label="Close" onClick={() => setForm(null)}>×</button></div><form onSubmit={save}><div className="bond-form-grid">
      <label className="form-field"><span>ISIN</span><input required maxLength={12} minLength={12} pattern="[A-Z]{2}[A-Z0-9]{9}[0-9]" title="Enter a 12-character ISIN in uppercase" value={form.isin} onChange={event => update("isin", event.target.value.toUpperCase())} placeholder="UA4000231281"/></label>
      <label className="form-field"><span>Name</span><input required maxLength={120} value={form.name} onChange={event => update("name", event.target.value)} placeholder="e.g. Ukraine 2027"/></label>
      <label className="form-field"><span>Status</span><select value={form.status} onChange={event => update("status", event.target.value)}>{bondStatuses.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <label className="form-field"><span>Face value</span><input required type="number" min="0.000001" step="0.000001" value={form.faceValue} onChange={event => update("faceValue", event.target.value)}/></label>
      <label className="form-field"><span>Quantity</span><input required type="number" min="1" step="1" value={form.quantity} onChange={event => update("quantity", event.target.value)}/></label>
      <label className="form-field"><span>Purchase price <small>per bond</small></span><input required type="number" min="0" step="0.000001" value={form.purchasePrice} onChange={event => update("purchasePrice", event.target.value)}/></label>
      <label className="form-field"><span>Currency</span><select value={form.currency} onChange={event => update("currency", event.target.value)}>{currencies.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="form-field"><span>Interest rate (%)</span><input required type="number" min="0" step="0.000001" value={form.interestRate} onChange={event => update("interestRate", event.target.value)}/></label>
      <label className="form-field"><span>Tax rate (%)</span><input required type="number" min="0" max="100" step="0.000001" value={form.taxRate} onChange={event => update("taxRate", event.target.value)}/></label>
      <label className="form-field"><span>Purchase date</span><input required type="date" value={form.purchaseDate} onChange={event => update("purchaseDate", event.target.value)}/></label>
      <label className="form-field"><span>Maturity date</span><input required type="date" min={form.purchaseDate} value={form.maturityDate} onChange={event => update("maturityDate", event.target.value)}/></label>
      <label className="form-field"><span>First coupon date</span><input required type="date" value={form.firstCouponDate} onChange={event => update("firstCouponDate", event.target.value)}/></label>
      <label className="form-field"><span>Coupon frequency</span><select value={form.couponFrequency} onChange={event => update("couponFrequency", event.target.value)}>{couponFrequencies.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <label className="form-field"><span>Day count convention</span><select value={form.dayCountConvention} onChange={event => update("dayCountConvention", event.target.value)}>{dayCountConventions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="form-field"><span>Coupon payment <small>per bond</small></span><input required type="number" min="0" step="0.000001" value={form.fixedCoupon} onChange={event => update("fixedCoupon", event.target.value)}/></label>
      </div><div className="bond-form-actions"><button type="button" className="button" onClick={() => setForm(null)} disabled={saving}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add bond"}</button></div></form></section></div>}
  </>;
}
