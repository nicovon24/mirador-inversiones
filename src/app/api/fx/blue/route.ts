import { getBlueRate } from "@/lib/market/blue";

export async function GET() {
  try {
    return Response.json(await getBlueRate());
  } catch {
    return Response.json({ rate: null, updatedAt: null, error: "Cotización blue no disponible" }, { status: 502 });
  }
}
