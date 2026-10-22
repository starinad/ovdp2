"use client";

import { useEffect, useMemo, useState } from "react";

import type { Purchase } from "@/lib/envelop-types";
const pageSize = 15;
const money = (value: number, currency: "UAH" | "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);

export default function EnvelopTab() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [spentUah, setSpentUah] = useState("");
  const [receivedUsd, setReceivedUsd] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPurchasedAt, setEditPurchasedAt] = useState("");
  const [page, setPage] = useState(1);
  const [editSpentUah, setEditSpentUah] = useState("");
  const [editReceivedUsd, setEditReceivedUsd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/envelop").then(async (response) => {
      if (!response.ok) throw new Error("Could not load Envelop purchases");
      setPurchases(await response.json());
    });
  useEffect(() => {
    Promise.all([
      load(),
      fetch("/api/exchange-rates")
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((rates) => setRate(rates.USD.rate)),
    ])
      .catch(() =>
        setError("Could not load Envelop data or the current USD rate."),
      )
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    const uah = purchases.reduce(
      (sum, purchase) => sum + Number(purchase.spentUah),
      0,
    );
    const usd = purchases.reduce(
      (sum, purchase) => sum + Number(purchase.receivedUsd),
      0,
    );
    const value = rate === null ? null : usd * rate;
    return {
      uah,
      usd,
      average: usd ? uah / usd : 0,
      value,
      profit: value === null ? null : value - uah,
      percent: value === null || !uah ? null : ((value - uah) / uah) * 100,
    };
  }, [purchases, rate]);
  const pageCount = Math.max(1, Math.ceil(purchases.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagePurchases = purchases.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const addPurchase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/envelop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spentUah: Number(spentUah),
          receivedUsd: Number(receivedUsd),
        }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not save purchase",
        );
      setPurchases([await response.json(), ...purchases]);
      setPage(1);
      setSpentUah("");
      setReceivedUsd("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save purchase",
      );
    } finally {
      setSaving(false);
    }
  };

  const savePurchase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingId === null) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/envelop/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spentUah: Number(editSpentUah),
          receivedUsd: Number(editReceivedUsd),
          purchasedAt: editPurchasedAt,
        }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not update purchase",
        );
      const updated: Purchase = await response.json();
      setPurchases(
        purchases.map((purchase) =>
          purchase.id === updated.id ? updated : purchase,
        ),
      );
      setEditingId(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update purchase",
      );
    } finally {
      setSaving(false);
    }
  };

  const deletePurchase = async (id: string) => {
    if (!window.confirm("Delete this purchase?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/envelop/${id}`, { method: "DELETE" });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not delete purchase",
        );
      setPurchases(purchases.filter((purchase) => purchase.id !== id));
      setPage(
        Math.min(
          currentPage,
          Math.max(1, Math.ceil((purchases.length - 1) / pageSize)),
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not delete purchase",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="welcome-row bonds-welcome">
        <div>
          <div className="eyebrow">USD SAVINGS</div>
          <h1>Envelop</h1>
          <p className="subhead">Track the dollars you bought with UAH.</p>
        </div>
      </div>
      {error && (
        <div className="bond-alert" role="alert">
          {error}
        </div>
      )}
      <div className="stats analytics-stats envelop-stats">
        <div className="stat-card">
          <div className="stat-top">USD balance</div>
          <div className="stat-value">{money(totals.usd, "USD")}</div>
          <div className="stat-foot">
            Across {purchases.length} purchase
            {purchases.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-top">Average buy rate</div>
          <div className="stat-value">
            {totals.usd ? `₴${totals.average.toFixed(2)}` : "—"}
          </div>
          <div className="stat-foot">UAH spent per USD</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">Current value</div>
          <div className="stat-value">
            {totals.value === null ? "—" : money(totals.value, "UAH")}
          </div>
          <div className="stat-foot">
            {rate === null
              ? "Current rate unavailable"
              : `At ₴${rate.toFixed(2)} per USD`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-top">Rate gain</div>
          <div
            className={`stat-value ${totals.profit !== null && totals.profit < 0 ? "negative" : "positive"}`}
          >
            {totals.profit === null ? "—" : money(totals.profit, "UAH")}
          </div>
          <div className="stat-foot">
            {totals.percent === null
              ? "Compared with total spent"
              : `${totals.percent >= 0 ? "+" : ""}${totals.percent.toFixed(2)}% on UAH spent`}
          </div>
        </div>
      </div>
      <section className="panel envelop-panel">
        <div className="panel-head">
          <div>
            <h2>Add USD purchase</h2>
            <p>Enter the UAH spent and USD received.</p>
          </div>
        </div>
        <form className="envelop-form" onSubmit={addPurchase}>
          <label className="form-field">
            <span>UAH spent</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={spentUah}
              onChange={(event) => setSpentUah(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>USD received</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={receivedUsd}
              onChange={(event) => setReceivedUsd(event.target.value)}
            />
          </label>
          <button className="button add-bond" disabled={saving}>
            {saving ? "Saving…" : "Add purchase"}
          </button>
        </form>
      </section>
      <section className="panel envelop-panel">
        <div className="panel-head">
          <div>
            <h2>Purchase history</h2>
            <p>Recorded purchases, newest first.</p>
          </div>
        </div>
        {loading ? (
          <div className="bond-state">Loading…</div>
        ) : purchases.length ? (
          <>
            <div className="table-scroll">
              <table className="envelop-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>UAH spent</th>
                    <th>USD received</th>
                    <th>Buy rate</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pagePurchases.map((purchase) => (
                    <tr key={purchase.id}>
                      {editingId === purchase.id ? (
                        <>
                          <td>
                            <input
                              form={`purchase-edit-${purchase.id}`}
                              aria-label="Purchase date"
                              type="date"
                              required
                              value={editPurchasedAt}
                              onChange={(event) =>
                                setEditPurchasedAt(event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              form={`purchase-edit-${purchase.id}`}
                              aria-label="UAH spent"
                              type="number"
                              min="0.01"
                              step="0.01"
                              required
                              value={editSpentUah}
                              onChange={(event) =>
                                setEditSpentUah(event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              form={`purchase-edit-${purchase.id}`}
                              aria-label="USD received"
                              type="number"
                              min="0.01"
                              step="0.01"
                              required
                              value={editReceivedUsd}
                              onChange={(event) =>
                                setEditReceivedUsd(event.target.value)
                              }
                            />
                          </td>
                          <td>
                            ₴
                            {(
                              Number(editSpentUah) / Number(editReceivedUsd)
                            ).toFixed(2)}
                          </td>
                          <td>
                            <form
                              id={`purchase-edit-${purchase.id}`}
                              className="envelop-actions"
                              onSubmit={savePurchase}
                            >
                              <button
                                className="button primary"
                                disabled={saving}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="button"
                                disabled={saving}
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </button>
                            </form>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            {new Date(
                              purchase.purchasedAt,
                            ).toLocaleDateString()}
                          </td>
                          <td>{money(Number(purchase.spentUah), "UAH")}</td>
                          <td>{money(Number(purchase.receivedUsd), "USD")}</td>
                          <td>
                            ₴
                            {(
                              Number(purchase.spentUah) /
                              Number(purchase.receivedUsd)
                            ).toFixed(2)}
                          </td>
                          <td>
                            <div className="envelop-actions">
                              <button
                                className="button"
                                disabled={saving}
                                onClick={() => {
                                  setEditingId(purchase.id);
                                  setEditSpentUah(String(purchase.spentUah));
                                  setEditReceivedUsd(
                                    String(purchase.receivedUsd),
                                  );
                                  const date = new Date(purchase.purchasedAt);
                                  setEditPurchasedAt(
                                    new Date(
                                      date.getTime() -
                                        date.getTimezoneOffset() * 60000,
                                    )
                                      .toISOString()
                                      .slice(0, 10),
                                  );
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="button"
                                disabled={saving}
                                onClick={() => deletePurchase(purchase.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bond-table-footer">
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, purchases.length)} of{" "}
                {purchases.length} purchases
              </span>
              {pageCount > 1 && (
                <div className="pagination">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {pageCount}
                  </span>
                  <button
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bond-state">
            <strong>No purchases yet</strong>
            <span>Add your first USD purchase above.</span>
          </div>
        )}
      </section>
      <p className="fx-note">
        Rate gain reflects exchange rate movement only; fees and spreads are not
        included.
      </p>
    </>
  );
}
