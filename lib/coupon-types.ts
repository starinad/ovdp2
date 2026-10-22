import type { Currency } from "./bond-types";

// PostgreSQL numeric amounts are serialized as decimal strings.
export type Coupon = {
  id: string;
  bondId: string;
  bondName: string;
  isin: string;
  currency: Currency;
  paymentDate: string;
  grossAmount: string;
  taxAmount: string;
  netAmount: string;
  status: "PAID" | "SCHEDULED" | "CANCELLED";
};
