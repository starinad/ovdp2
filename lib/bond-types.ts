export const bondStatuses = ["ACTIVE", "MATURED", "REDEEMED", "SOLD"] as const;
export const currencies = ["UAH", "USD", "EUR"] as const;
export const couponFrequencies = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "AT_MATURITY"] as const;
export const dayCountConventions = ["ACT/ACT", "ACT/365", "ACT/360", "30/360"] as const;

export type BondInput = {
  isin: string;
  name: string;
  status: typeof bondStatuses[number];
  faceValue: string;
  quantity: string;
  purchasePrice: string;
  currency: typeof currencies[number];
  interestRate: string;
  purchaseDate: string;
  maturityDate: string;
  firstCouponDate: string;
  couponFrequency: typeof couponFrequencies[number];
  dayCountConvention: typeof dayCountConventions[number];
  fixedCoupon: string;
};

export type Bond = Omit<BondInput, "quantity"> & { id: string; quantity: number };

export function validateBond(value: unknown): value is BondInput {
  if (!value || typeof value !== "object") return false;
  const bond = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof bond[key] === "string" && bond[key].length > 0 && bond[key].length <= max;
  const decimal = (key: string, allowZero = false, maxIntegerDigits = 12) => typeof bond[key] === "string" && new RegExp(`^\\d{1,${maxIntegerDigits}}(\\.\\d{1,6})?$`).test(bond[key] as string) && (allowZero || Number(bond[key]) > 0);
  const date = (key: string) => {
    if (typeof bond[key] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bond[key])) return false;
    const parsed = new Date(`${bond[key]}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === bond[key];
  };
  return text("isin", 12) && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(bond.isin as string)
    && text("name", 120) && bondStatuses.includes(bond.status as typeof bondStatuses[number])
    && decimal("faceValue") && /^\d+$/.test(String(bond.quantity)) && Number(bond.quantity) > 0 && Number(bond.quantity) <= 2147483647
    && decimal("purchasePrice", true) && currencies.includes(bond.currency as typeof currencies[number])
    && decimal("interestRate", true, 3) && date("purchaseDate") && date("maturityDate") && date("firstCouponDate")
    && (bond.maturityDate as string) >= (bond.purchaseDate as string) && (bond.firstCouponDate as string) <= (bond.maturityDate as string)
    && couponFrequencies.includes(bond.couponFrequency as typeof couponFrequencies[number])
    && dayCountConventions.includes(bond.dayCountConvention as typeof dayCountConventions[number])
    && decimal("fixedCoupon", true);
}
