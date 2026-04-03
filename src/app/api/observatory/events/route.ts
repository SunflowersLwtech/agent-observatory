import { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  getEvents,
  getEventStats,
  getTokenStates,
  getCorrelatedEvents,
  type EventType,
  type RiskLevel,
} from "@/lib/observatory/event-store";
import { computeSessionAnomalyScore } from "@/lib/observatory/risk-classifier";

export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view");

  if (view === "correlation") {
    const service = searchParams.get("service") || undefined;
    const since = searchParams.get("since")
      ? Number(searchParams.get("since"))
      : Date.now() - 15 * 60 * 1000; // default last 15 min
    return Response.json({ correlations: getCorrelatedEvents(service, since) });
  }

  if (view === "stats") {
    const allEvents = getEvents({ limit: 100 });
    return Response.json({
      stats: getEventStats(),
      tokenStates: getTokenStates(),
      anomaly: computeSessionAnomalyScore(allEvents),
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
