"use client";

import { useLayoutEffect, useState } from "react";
import BondsTab from "./BondsTab";
import CouponsTab from "./CouponsTab";
import CashflowTab from "./CashflowTab";
import LivePricesTab from "./LivePricesTab";
import SignOutButton from "./SignOutButton";

const tabs = ["Analytics", "Bonds", "Coupons", "Cashflow", "Live Prices"] as const;
type Tab = typeof tabs[number];

const positions = [
  { name: "UA 2027 · 15.84%", code: "UA4000231281", maturity: "18 Nov 2027", coupon: "15.84%", value: "₴ 1,248,600", share: 38, tone: "blue" },
  { name: "UA 2026 · 16.00%", code: "UA4000231125", maturity: "04 Mar 2026", coupon: "16.00%", value: "₴ 936,400", share: 29, tone: "sky" },
  { name: "UA 2028 · 17.00%", code: "UA4000231491", maturity: "22 Aug 2028", coupon: "17.00%", value: "₴ 684,000", share: 21, tone: "cyan" },
  { name: "UA 2025 · 14.65%", code: "UA4000230879", maturity: "12 Dec 2025", coupon: "14.65%", value: "₴ 390,000", share: 12, tone: "pale" },
];

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

function Chart() {
  return <div className="chart-wrap">
    <div className="chart-y"><span>₴ 3.5m</span><span>₴ 3.0m</span><span>₴ 2.5m</span><span>₴ 2.0m</span><span>₴ 1.5m</span></div>
    <svg className="chart" viewBox="0 0 760 220" preserveAspectRatio="none" role="img" aria-label="Portfolio value rising over the past year">
      <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2f70e8" stopOpacity=".17"/><stop offset="100%" stopColor="#2f70e8" stopOpacity="0"/></linearGradient></defs>
      {[20, 65, 110, 155, 200].map(y => <line key={y} x1="0" y1={y} x2="760" y2={y} className="gridline"/>)}
      <path d="M0 177 C30 172 42 181 65 161 S106 166 126 145 S165 152 188 130 S220 144 244 122 S278 132 301 111 S337 124 359 95 S393 108 418 84 S453 98 476 74 S512 89 536 62 S570 71 597 57 S630 71 652 39 S692 56 714 27 S742 39 760 15 L760 220 L0 220Z" fill="url(#fill)"/>
      <path d="M0 177 C30 172 42 181 65 161 S106 166 126 145 S165 152 188 130 S220 144 244 122 S278 132 301 111 S337 124 359 95 S393 108 418 84 S453 98 476 74 S512 89 536 62 S570 71 597 57 S630 71 652 39 S692 56 714 27 S742 39 760 15" className="line"/>
      <circle cx="760" cy="15" r="5" className="chart-dot"/>
    </svg>
    <div className="chart-x"><span>Oct ’24</span><span>Dec ’24</span><span>Feb ’25</span><span>Apr ’25</span><span>Jun ’25</span><span>Aug ’25</span></div>
  </div>;
}

function Analytics() {
  return <>
    <div className="welcome-row"><div><div className="eyebrow">SUNDAY, SEPTEMBER 27, 2026</div><h1>Your portfolio, <span>in focus.</span></h1><p className="subhead">Here’s how your investments are doing today.</p></div><button className="button primary"><Icon name="download" size={16}/> Export report</button></div>
    <section className="stats">
      <article className="stat-card"><div className="stat-top"><span>Total portfolio value</span><span className="stat-icon"><Icon name="layers"/></span></div><div className="stat-value">₴ 3,259,000</div><div className="stat-foot"><span className="positive">↗ 8.42%</span><span>vs. last month</span></div><div className="mini-spark"><svg viewBox="0 0 120 30" preserveAspectRatio="none"><path d="M0 24 13 20 24 23 37 14 49 18 62 11 74 15 87 7 101 10 120 2"/></svg></div></article>
      <article className="stat-card"><div className="stat-top"><span>Invested amount</span><span className="stat-icon"><Icon name="arrows"/></span></div><div className="stat-value">₴ 3,000,000</div><div className="stat-foot"><span className="muted">92.1%</span><span>of portfolio value</span></div><div className="stat-progress"><i style={{width:"92%"}}/></div></article>
      <article className="stat-card"><div className="stat-top"><span>Unrealized profit</span><span className="stat-icon"><span className="profit-mark">↗</span></span></div><div className="stat-value positive">+₴ 259,000</div><div className="stat-foot"><span className="positive">+8.63%</span><span>total return</span></div><div className="stat-note">Including accrued interest</div></article>
      <article className="stat-card"><div className="stat-top"><span>Next coupon</span><span className="stat-icon"><Icon name="calendar"/></span></div><div className="stat-value">₴ 24,480</div><div className="stat-foot"><span className="date-pill">OCT 12</span><span>in 15 days</span></div><div className="stat-note">2 bonds paying</div></article>
    </section>
    <section className="overview-grid">
      <article className="panel performance"><div className="panel-head"><div><h2>Portfolio performance</h2><p>Value over time</p></div><div className="segmented"><button>1M</button><button>3M</button><button>6M</button><button className="selected">1Y</button><button>ALL</button></div></div><div className="chart-legend"><span><i className="legend-dot blue-dot"/>Portfolio value</span><span><i className="legend-dot gray-dot"/>Invested amount</span></div><Chart/><div className="chart-bottom"><span>Last updated just now</span><span className="chart-change">↗ 8.42% <small>this year</small></span></div></article>
      <article className="panel allocation"><div className="panel-head"><div><h2>Asset allocation</h2><p>By bond position</p></div><button className="icon-button"><span>•••</span></button></div><div className="donut-area"><div className="donut"><div className="donut-center"><strong>4</strong><span>positions</span></div></div></div><div className="allocation-list">{positions.map(p=><div className="allocation-row" key={p.code}><span className={`allocation-key ${p.tone}`}/><span className="allocation-name">{p.name.slice(0, 7)} <small>{p.name.slice(8)}</small></span><strong>{p.share}%</strong></div>)}</div><button className="text-link">View all bonds <Icon name="chevron" size={14}/></button></article>
    </section>
    <section className="panel holdings"><div className="panel-head"><div><h2>Your bonds</h2><p>4 active positions</p></div><button className="text-link">View all <Icon name="chevron" size={14}/></button></div><div className="table-scroll"><table><thead><tr><th>Bond</th><th>Maturity date</th><th>Coupon rate</th><th>Portfolio share</th><th className="align-right">Market value</th><th/></tr></thead><tbody>{positions.slice(0,3).map(p=><tr key={p.code}><td><span className="bond-avatar">₴</span><span className="bond-cell"><strong>{p.name}</strong><small>{p.code}</small></span></td><td>{p.maturity}</td><td><span className="coupon">{p.coupon}</span></td><td><span className="share-cell"><span className="share-track"><i className={p.tone} style={{width:`${p.share * 2.2}px`}}/></span>{p.share}%</span></td><td className="align-right value-cell">{p.value}</td><td><button className="row-more">•••</button></td></tr>)}</tbody></table></div></section>
    <section className="bottom-grid"><article className="panel coupon-panel"><div className="panel-head"><div><h2>Upcoming coupons</h2><p>Your next interest payments</p></div><button className="text-link">All coupons <Icon name="chevron" size={14}/></button></div><div className="coupon-item"><div className="calendar-tile"><b>OCT</b><strong>12</strong></div><div className="coupon-detail"><strong>UA 2027 · 15.84%</strong><span>Interest payment · 1,200 bonds</span></div><strong className="coupon-amount">₴ 15,840</strong></div><div className="coupon-item"><div className="calendar-tile"><b>OCT</b><strong>25</strong></div><div className="coupon-detail"><strong>UA 2026 · 16.00%</strong><span>Interest payment · 600 bonds</span></div><strong className="coupon-amount">₴ 8,640</strong></div></article><article className="panel cash-panel"><div className="panel-head"><div><h2>Cashflow forecast</h2><p>Expected in the next 30 days</p></div><span className="cash-icon"><Icon name="arrows"/></span></div><div className="cash-summary"><span>Expected income</span><strong>₴ 24,480</strong></div><div className="cash-bar"><i/><i/><i/></div><div className="cash-legend"><span><i/>Coupons <b>₴ 24,480</b></span><span><i/>Maturities <b>₴ 0</b></span></div><button className="text-link">Explore cashflow <Icon name="chevron" size={14}/></button></article></section>
  </>;
}

function SimpleTab({ tab }: { tab: Tab }) {
  const descriptions: Record<Tab, string> = { Analytics: "", Bonds: "All your Ukrainian government bond positions in one place.", Coupons: "Upcoming interest payments from your bond portfolio.", Cashflow: "A timeline of expected coupon and maturity payments.", "Live Prices": "Current government bond prices and yields." };
  return <div className="simple-panel panel"><div className="eyebrow">PORTFOLIO</div><h1>{tab}</h1><p>{descriptions[tab]}</p><div className="simple-metrics"><span><small>{tab === "Bonds" ? "ACTIVE POSITIONS" : tab === "Coupons" ? "NEXT PAYMENT" : "NEXT 30 DAYS"}</small><strong>{tab === "Bonds" ? "4 bonds" : tab === "Coupons" ? "₴ 24,480" : "₴ 24,480"}</strong></span><span><small>PORTFOLIO VALUE</small><strong>₴ 3,259,000</strong></span><button className="button primary"><Icon name="plus" size={16}/>{tab === "Bonds" ? "Add bond" : "Add transaction"}</button></div><div className="empty-table"><span className="empty-icon"><Icon name={tab === "Bonds" ? "layers" : tab === "Coupons" ? "calendar" : "arrows"} size={23}/></span><strong>{tab === "Bonds" ? "Your positions are ready" : tab === "Coupons" ? "Coupon schedule" : "Cashflow schedule"}</strong><span>Connect your transactions to see the full picture here.</span></div></div>;
}

export default function Home() {
  const [active, setActive] = useState<Tab>("Bonds");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [themeReady] = useState(true);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState("");
  useLayoutEffect(() => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"), []);
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
  return <div className="app-shell"><header className="topbar"><a className="brand" href="#"><span className="brand-mark"><span/></span><span>obl<span className="brand-dot">.</span>ig</span></a><nav className="main-nav" aria-label="Main navigation">{tabs.map((tab, i)=><button key={tab} onClick={()=>setActive(tab)} className={active === tab ? "nav-item active" : "nav-item"}><Icon name={["grid","layers","calendar","arrows","search"][i]}/>{tab}</button>)}</nav><div className="top-actions"><button className="theme-toggle" onClick={toggleTheme} disabled={!themeReady || themeSaving} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{themeSaving ? "Saving…" : theme === "dark" ? "☀ Light" : "☾ Dark"}</button>{themeError && <span className="theme-error" role="alert">{themeError}</span>}<span className="top-divider"/><SignOutButton/></div></header><main className="main-content">{active === "Analytics" ? <Analytics/> : active === "Bonds" ? <BondsTab/> : active === "Coupons" ? <CouponsTab/> : active === "Cashflow" ? <CashflowTab/> : <LivePricesTab/>}<footer className="footer"><span>© 2026 OBLIG</span><span><i/> All systems operational</span><span>Data refreshed a moment ago</span></footer></main></div>;
}
