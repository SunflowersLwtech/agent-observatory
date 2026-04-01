import { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  getEvents,
  getEventStats,
  getTokenStates,
  type EventType,
  type RiskLevel,
} from "@/lib/observatory/event-store";

export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view");

  if (view === "stats") {
    return Response.json({
      stats: getEventStats(),
      tokenStates: getTokenStates(),
    });
  }

  const events = getEvents({
    limit: Number(searchParams.get("limit")) || 100,
    since: searchParams.get("since")
      ? Number(searchParams.get("since"))
      : undefined,
    type: (searchParams.get("type") as EventType) || undefined,
    service: searchParams.get("service") || undefined,
    riskLevel: (searchParams.get("riskLevel") as RiskLevel) || undefined,
  });

  return Response.json({ events });
}
