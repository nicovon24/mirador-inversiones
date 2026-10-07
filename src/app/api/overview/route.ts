import { getOverviewCards } from "@/lib/market";

export async function GET() {
  const cards = await getOverviewCards();
  return Response.json({ cards, fetchedAt: new Date().toISOString() });
}
