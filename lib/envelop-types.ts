export type Purchase = {
  id: string;
  spentUah: string;
  receivedUsd: string;
  purchasedAt: string;
};

export type PurchaseInput = {
  spentUah: number;
  receivedUsd: number;
  purchasedAt?: unknown;
};

export function validatePurchase(value: unknown): value is PurchaseInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const purchase = value as Record<string, unknown>;
  return (
    typeof purchase.spentUah === "number" &&
    Number.isFinite(purchase.spentUah) &&
    purchase.spentUah > 0 &&
    typeof purchase.receivedUsd === "number" &&
    Number.isFinite(purchase.receivedUsd) &&
    purchase.receivedUsd > 0
  );
}
