export type FxRates = Record<"USD" | "EUR", number>;
export type ExchangeRates = Record<
  "USD" | "EUR",
  { rate: number; exchangedate: string }
> & { stale?: boolean };
export type HistoricalRates = Record<
  "USD" | "EUR",
  { date: string; rate: number }[]
>;

// NBU history is ordered by date; never use a rate after the requested day.
export function rateAtDate(
  history: HistoricalRates | null,
  currency: "USD" | "EUR",
  date: string,
) {
  const series = history?.[currency] ?? [];
  const day = date.slice(0, 10);
  let low = 0;
  let high = series.length - 1;
  let index = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (series[mid].date <= day) {
      index = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return series[index]?.rate;
}
