import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/require-user";

export async function GET() {
  if (!(await requireUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const response = await fetch("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json", {
      next: { revalidate: 43_200 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`NBU request failed (${response.status})`);
    const entries: unknown = await response.json();
    if (!Array.isArray(entries)) throw new Error("NBU returned invalid exchange rates");

    const rates = Object.fromEntries(entries
      .filter((entry): entry is { cc: string; rate: number; exchangedate: string } =>
        entry && typeof entry === "object" && ["USD", "EUR"].includes((entry as { cc?: string }).cc ?? "")
        && typeof (entry as { rate?: unknown }).rate === "number"
        && Number.isFinite((entry as { rate: number }).rate))
      .map(({ cc, rate, exchangedate }) => [cc, { rate, exchangedate }]));

    if (!rates.USD || !rates.EUR) throw new Error("NBU response is missing USD or EUR rates");
    return NextResponse.json(rates);
  } catch (error) {
    console.error("Could not load NBU exchange rates", error);
    return NextResponse.json({ error: "Could not load exchange rates" }, { status: 503 });
  }
}
