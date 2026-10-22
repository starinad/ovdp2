import type { Currency } from "./bond-types";

export const preciseCurrency = (value: number, currency: Currency) =>
  new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
export const preciseMoney = (value: number) => preciseCurrency(value, "UAH");
export const percent = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en", {
        style: "percent",
        maximumFractionDigits: 2,
      }).format(value);
