"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import BondsTab from "./BondsTab";
import CouponsTab from "./CouponsTab";
import CashflowTab from "./CashflowTab";
import LivePricesTab from "./LivePricesTab";
import SignOutButton from "./SignOutButton";
import AnalyticsTab from "./AnalyticsTab";

const tabs = ["Analytics", "Bonds", "Coupons", "Cashflow", "Live Prices"] as const;
type Tab = typeof tabs[number];
type ExchangeRates = { USD: { rate: number; exchangedate: string }; EUR: { rate: number; exchangedate: string }; stale?: boolean };

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "grid") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
  if (name === "layers") return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
  if (name === "arrows") return <svg {...common}><path d="M7 7h13l-3-3M17 17H4l3 3"/><path d="m17 4 3 3-3 3M7 14l-3 3 3 3"/></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
  if (name === "chevron") return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
  if (name === "download") return <svg {...common}><path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/></svg>;
  return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
}

export default function Home() {
  const [active, setActive] = useState<Tab>("Analytics");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [themeReady] = useState(true);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState("");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  useLayoutEffect(() => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"), []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/exchange-rates", { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(rates => { localStorage.setItem("exchangeRates", JSON.stringify(rates)); setExchangeRates({ ...rates, stale: false }); })
      .catch(() => {
        try {
          const saved = JSON.parse(localStorage.getItem("exchangeRates") || "null");
          if (saved?.USD?.rate && saved?.EUR?.rate) setExchangeRates({ ...saved, stale: true });
        } catch { /* ignore invalid cached data */ }
      });
    return () => controller.abort();
  }, []);
  const toggleTheme = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setThemeSaving(true);
    setThemeError("");
    try {
      const response = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: nextTheme }) });
      if (!response.ok) throw new Error((await response.json()).error || "Could not save appearance preference");
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    } catch (reason) {
      setThemeError(reason instanceof Error ? reason.message : "Could not save appearance preference");
    } finally {
      setThemeSaving(false);
    }
  };
  return <div className="app-shell"><header className="topbar"><a className="brand" href="#"><span className="brand-mark"><span/></span><span>obl<span className="brand-dot">.</span>ig</span></a><nav className="main-nav" aria-label="Main navigation">{tabs.map((tab, i)=><button key={tab} onClick={()=>setActive(tab)} className={active === tab ? "nav-item active" : "nav-item"}><Icon name={["grid","layers","calendar","arrows","search"][i]}/>{tab}</button>)}</nav><div className="top-actions"><div className="exchange-rates" aria-label={`Official NBU exchange rates to hryvnia${exchangeRates?.stale ? ", cached rates; live rates unavailable" : ""}`} title={exchangeRates ? `NBU rate as of ${exchangeRates.USD.exchangedate}${exchangeRates.stale ? " · cached; live rates unavailable" : ""}` : "Official NBU exchange rates"}><span>USD <strong>{exchangeRates ? `₴${exchangeRates.USD.rate.toFixed(2)}` : "—"}</strong></span><span>EUR <strong>{exchangeRates ? `₴${exchangeRates.EUR.rate.toFixed(2)}` : "—"}</strong></span>{exchangeRates?.stale && <span className="exchange-rate-status">Cached</span>}</div><button className="theme-toggle" onClick={toggleTheme} disabled={!themeReady || themeSaving} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{themeSaving ? "Saving…" : theme === "dark" ? "☀ Light" : "☾ Dark"}</button>{themeError && <span className="theme-error" role="alert">{themeError}</span>}<span className="top-divider"/><SignOutButton/></div></header><main className="main-content">{active === "Analytics" ? <AnalyticsTab/> : active === "Bonds" ? <BondsTab/> : active === "Coupons" ? <CouponsTab/> : active === "Cashflow" ? <CashflowTab/> : <LivePricesTab/>}<footer className="footer"><span>© 2026 OBLIG</span><span><i/> All systems operational</span><span>Data refreshed a moment ago</span><span title="Build commit">Version {process.env.NEXT_PUBLIC_APP_VERSION}</span></footer></main></div>;
}
