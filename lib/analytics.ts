import type { Currency } from "./bond-types";
import {
  rateAtDate,
  type FxRates,
  type HistoricalRates,
} from "./exchange-rates";

export type CashFlow = { date: string; amount: number };

export function toBaseCurrency(
  value: number,
  from: Currency,
  to: Currency,
  rates: FxRates,
) {
  const uahValue = from === "UAH" ? value : value * rates[from];
  return to === "UAH" ? uahValue : uahValue / rates[to];
}

export function ratesOnDate(
  history: HistoricalRates | null,
  date: string,
  fallback: FxRates,
): FxRates {
  return {
    USD: rateAtDate(history, "USD", date) ?? fallback.USD,
    EUR: rateAtDate(history, "EUR", date) ?? fallback.EUR,
  };
}

export function xirr(flows: CashFlow[]) {
  if (
    !flows.some((flow) => flow.amount > 0) ||
    !flows.some((flow) => flow.amount < 0)
  )
    return null;
  const firstDate = Math.min(
    ...flows.map((flow) =>
      new Date(`${flow.date.slice(0, 10)}T00:00:00Z`).getTime(),
    ),
  );
  const npv = (rate: number) =>
    flows.reduce(
      (sum, flow) =>
        sum +
        flow.amount /
          (1 + rate) **
            ((new Date(`${flow.date.slice(0, 10)}T00:00:00Z`).getTime() -
              firstDate) /
              31_536_000_000),
      0,
    );
  let low = -0.9999;
  let high = 1;
  while (npv(low) * npv(high) > 0 && high < 1_000_000) high = high * 2 + 1;
  if (npv(low) * npv(high) > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (npv(low) * npv(mid) <= 0) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

export const FORECAST_MONTHS = 36;

export function buildForecast(
  contribution: number,
  annualRate: number,
  startingValue: number,
) {
  const monthlyRate = (1 + annualRate) ** (1 / 12) - 1;
  let value = startingValue;
  return Array.from({ length: FORECAST_MONTHS + 1 }, (_, i) => {
    if (i > 0) value = value * (1 + monthlyRate) + contribution;
    return { value, contributed: contribution * i };
  });
}
