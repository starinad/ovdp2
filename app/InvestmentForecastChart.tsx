"use client";

import {
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { buildForecast, FORECAST_MONTHS } from "@/lib/analytics";
import { preciseMoney, percent } from "@/lib/format";

export default function InvestmentForecastChart({
  purchaseContribution,
  settingContribution,
  settingNote,
  purchaseMonthLabel,
  annualRate,
  startingValue,
}: {
  purchaseContribution: number;
  settingContribution: number | null;
  settingNote: string;
  purchaseMonthLabel: string;
  annualRate: number;
  startingValue: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const W = 650,
    H = 262,
    L = 58,
    R = 634,
    T = 16,
    B = 212;
  const hasPurchases = purchaseContribution > 0;
  const hasSetting = settingContribution !== null && settingContribution > 0;
  const purchases = useMemo(
    () =>
      hasPurchases
        ? buildForecast(purchaseContribution, annualRate, startingValue)
        : null,
    [hasPurchases, purchaseContribution, annualRate, startingValue],
  );
  const setting = useMemo(
    () =>
      hasSetting
        ? buildForecast(
            settingContribution as number,
            annualRate,
            startingValue,
          )
        : null,
    [hasSetting, settingContribution, annualRate, startingValue],
  );
  const labels = useMemo(() => {
    const now = new Date();
    const short = new Intl.DateTimeFormat("en", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
    const long = new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return Array.from({ length: FORECAST_MONTHS + 1 }, (_, i) => {
      const month = new Date(
        Date.UTC(now.getFullYear(), now.getMonth() + i, 1),
      );
      return {
        short: i === 0 ? "Now" : short.format(month),
        long: i === 0 ? "Start · " + long.format(month) : long.format(month),
      };
    });
  }, []);
  const max = Math.max(
    1,
    purchases?.[FORECAST_MONTHS].value ?? 0,
    setting?.[FORECAST_MONTHS].value ?? 0,
  );
  const x = (index: number) => L + (index / FORECAST_MONTHS) * (R - L);
  const y = (amount: number) => B - (amount / max) * (B - T);
  const points = (series: { value: number }[]) =>
    series.map((item, i) => `${x(i)},${y(item.value)}`).join(" ");
  const shown = active ?? FORECAST_MONTHS;
  const indexFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * W;
    return Math.min(
      FORECAST_MONTHS,
      Math.max(0, Math.round(((viewX - L) / (R - L)) * FORECAST_MONTHS)),
    );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowLeft"
          ? -1
          : event.key === "PageUp"
            ? 6
            : event.key === "PageDown"
              ? -6
              : 0;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : FORECAST_MONTHS);
    } else if (step) {
      event.preventDefault();
      setActive(
        Math.min(
          FORECAST_MONTHS,
          Math.max(0, (active ?? FORECAST_MONTHS) + step),
        ),
      );
    }
  };
  const readout = (series: { value: number; contributed: number }[] | null) =>
    series
      ? {
          total: preciseMoney(series[shown].value),
          detail: `Holdings ${preciseMoney(startingValue)} · contributions ${preciseMoney(series[shown].contributed)} · growth ${preciseMoney(series[shown].value - startingValue - series[shown].contributed)}`,
        }
      : { total: "—", detail: "Scenario unavailable" };
  const purchasesReadout = readout(purchases);
  const settingReadout = readout(setting);
  const summary = `Three-year forecast. ${labels[shown].long}: ${hasSetting ? "Monthly Investment setting scenario " + settingReadout.total : "Monthly Investment setting scenario unavailable"}; ${hasPurchases ? "last month's purchases scenario " + purchasesReadout.total : "last month's purchases scenario unavailable"}.`;
  return (
    <article className="panel analytics-fx-panel forecast-panel">
      <div className="panel-head">
        <div>
          <h2>Three-year investment forecast · UAH</h2>
          <p>
            Projected value of repeating monthly contributions with coupons
            reinvested at {percent(annualRate)} a year
          </p>
        </div>
      </div>
      <div className="forecast-legend">
        <span>
          <i className="forecast-key-setting" />
          Monthly Investment setting ·{" "}
          <em>
            {hasSetting
              ? preciseMoney(settingContribution as number) + "/mo"
              : "not set"}
          </em>
        </span>
        <span>
          <i />
          Repeat {purchaseMonthLabel} purchases ·{" "}
          <em>
            {hasPurchases
              ? preciseMoney(purchaseContribution) + "/mo"
              : "no purchases"}
          </em>
        </span>
      </div>
      {hasPurchases || hasSetting ? (
        <>
          <div
            className="forecast-chart"
            tabIndex={0}
            role="group"
            aria-label="Forecast chart. Use the left and right arrow keys to move between months."
            onPointerMove={(event) => setActive(indexFromPointer(event))}
            onPointerDown={(event) => setActive(indexFromPointer(event))}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setActive(null);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setActive((current) => current ?? FORECAST_MONTHS)}
            onBlur={() => setActive(null)}
          >
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                const amount = max * fraction;
                const lineY = y(amount);
                return (
                  <g key={fraction}>
                    <line
                      x1={L}
                      x2={R}
                      y1={lineY}
                      y2={lineY}
                      className="forecast-grid"
                    />
                    <text
                      x={L - 7}
                      y={lineY + 4}
                      textAnchor="end"
                      className="forecast-label"
                    >
                      {new Intl.NumberFormat("uk-UA", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(amount)}
                    </text>
                  </g>
                );
              })}
              {[0, 12, 24, 36].map((index) => (
                <text
                  key={index}
                  x={x(index)}
                  y={B + 26}
                  textAnchor={
                    index === 0
                      ? "start"
                      : index === FORECAST_MONTHS
                        ? "end"
                        : "middle"
                  }
                  className="forecast-label"
                >
                  {labels[index].short}
                </text>
              ))}
              {setting && (
                <polyline
                  points={points(setting)}
                  className="forecast-line forecast-line-setting"
                />
              )}
              {purchases && (
                <polyline
                  points={points(purchases)}
                  className="forecast-line forecast-line-purchases"
                />
              )}
              {active !== null && (
                <g>
                  <line
                    x1={x(active)}
                    x2={x(active)}
                    y1={T}
                    y2={B}
                    className="forecast-guide"
                  />
                  {setting && (
                    <circle
                      cx={x(active)}
                      cy={y(setting[active].value)}
                      r="6"
                      className="forecast-dot forecast-dot-setting"
                    />
                  )}
                  {purchases && (
                    <circle
                      cx={x(active)}
                      cy={y(purchases[active].value)}
                      r="6"
                      className="forecast-dot forecast-dot-purchases"
                    />
                  )}
                </g>
              )}
            </svg>
          </div>
          <div className="forecast-readout" aria-live="polite">
            <div>
              <span>Month</span>
              <strong>{labels[shown].long}</strong>
              <small>
                {active === null
                  ? "End of forecast · hover or focus the chart to explore"
                  : `Month ${shown} of ${FORECAST_MONTHS}`}
              </small>
            </div>
            <div className="forecast-readout-setting">
              <span>Monthly Investment setting</span>
              <strong>{settingReadout.total}</strong>
              <small>{settingReadout.detail}</small>
            </div>
            <div className="forecast-readout-purchases">
              <span>Repeat {purchaseMonthLabel} purchases</span>
              <strong>{purchasesReadout.total}</strong>
              <small>{purchasesReadout.detail}</small>
            </div>
          </div>
        </>
      ) : (
        <div className="analytics-empty">
          No bonds were bought last month and no Monthly Investment is saved in
          Settings, so there is nothing to project.
        </div>
      )}
      <ul className="forecast-assumptions">
        <li>
          Starts with existing active and pending bond face value of{" "}
          {preciseMoney(startingValue)}, converted to UAH at current NBU rates.
          Contributions land at the end of each month for 36 months, beginning
          next month.
        </li>
        <li>
          Reinvestment uses the active UAH bonds’ quantity-weighted after-tax
          interest rate ({percent(annualRate)} a year), compounded monthly.
          Coupons are assumed to earn that rate immediately.
        </li>
        <li>
          “Repeat {purchaseMonthLabel} purchases” uses the total purchase cost
          of bonds bought in {purchaseMonthLabel}, converted to UAH at the NBU
          rate on each purchase date.
        </li>
        <li>
          “Monthly Investment setting” uses your saved amount
          {settingNote ? " (" + settingNote + ")" : ""}. Contributions stay
          flat; fees, spreads, and rate changes are excluded.
        </li>
      </ul>
    </article>
  );
}
