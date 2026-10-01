import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

const validDate = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

async function fetchHistory(currency: "USD" | "EUR", start: string, end: string) {
  const params = new URLSearchParams({
    start: start.replaceAll("-", ""),
    end: end.replaceAll("-", ""),
    valcode: currency,
    sort: "exchangedate",
    order: "asc",
    json: "",
  });
  const response = await fetch(`https://bank.gov.ua/NBU_Exchange/exchange_site?${params}`, {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`NBU ${currency} history failed (${response.status})`);
  const entries: unknown = await response.json();
  if (!Array.isArray(entries)) throw new Error(`NBU returned invalid ${currency} history`);
  return entries.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const { exchangedate, rate } = entry as { exchangedate?: unknown; rate?: unknown };
    if (typeof exchangedate !== "string" || typeof rate !== "number" || !Number.isFinite(rate)) return [];
    const [day, month, year] = exchangedate.split(".");
    return day && month && year ? [{ date: `${year}-${month}-${day}`, rate }] : [];
  });
}

export async function GET(request: Request) {
  if (!(await requireUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!validDate(start) || !validDate(end) || start! > end!) {
    return NextResponse.json({ error: "Valid start and end dates are required" }, { status: 400 });
  }

  try {
    const [USD, EUR] = await Promise.all([
      fetchHistory("USD", start!, end!),
      fetchHistory("EUR", start!, end!),
    ]);
    return NextResponse.json({ USD, EUR });
  } catch (error) {
    console.error("Could not load historical NBU exchange rates", error);
    return NextResponse.json({ error: "Could not load historical exchange rates" }, { status: 503 });
  }
}
