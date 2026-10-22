export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function monthlyIncomeSnapshots(today: Date) {
  return Array.from({ length: 12 }, (_, index) =>
    new Date(Date.UTC(
      today.getFullYear(),
      today.getMonth() - 11 + index,
      index === 11 ? today.getDate() : 28,
    )).toISOString().slice(0, 10),
  );
}
