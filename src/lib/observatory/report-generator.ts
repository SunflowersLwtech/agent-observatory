import {
  getEvents,
  type ObservatoryEvent,
} from "./event-store";
import { computeSessionAnomalyScore, OWASP_RISKS } from "./risk-classifier";

export interface ObservatoryReport {
  metadata: {
    generatedAt: string;
    version: string;
    eventCount: number;
    timeRange: { from: number; to: number };
  };
  owaspCoverage: {
    totalCategories: number;
    activeCategories: number;
    score: number;
    details: Array<{
      code: string;
      name: string;
      eventCount: number;
      status: "active" | "inactive";
    }>;
  };
  serviceSummary: Array<{
    service: string;
    totalCalls: number;
    successRate: number;
    riskBreakdown: Record<string, number>;
    scopes: string[];
  }>;
  anomalyScore: {
    score: number;
    recommendation: string;
    signals: Array<{
      type: string;
      severity: number;
      description: string;
    }>;
  };
  riskTimeline: Array<{
    timestamp: number;
    riskLevel: string;
    tool: string;
    service: string;
  }>;
  events: ObservatoryEvent[];
}

export function generateReport(): ObservatoryReport {
  const events = getEvents({ limit: 1000 });
  const anomaly = computeSessionAnomalyScore(events);

  // OWASP coverage
  const categoryCounts: Record<string, number> = {};
  events.forEach((e) => {
    e.owaspCategories.forEach((cat) => {
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    });
  });

  const owaspDetails = Object.entries(OWASP_RISKS).map(([code, risk]) => ({
    code,
    name: risk.name,
    eventCount: categoryCounts[code] ?? 0,
    status: (categoryCounts[code] ? "active" : "inactive") as
      | "active"
      | "inactive",
  }));

  // Service summary
  const serviceMap = new Map<
    string,
    {
      total: number;
      success: number;
      risks: Record<string, number>;
      scopes: Set<string>;
    }
  >();
  events.forEach((e) => {
    if (!serviceMap.has(e.service)) {
      serviceMap.set(e.service, {
        total: 0,
        success: 0,
        risks: {},
        scopes: new Set(),
      });
    }
    const svc = serviceMap.get(e.service)!;
    svc.total++;
    if (e.outcome === "success") svc.success++;
    svc.risks[e.riskLevel] = (svc.risks[e.riskLevel] ?? 0) + 1;
    e.scopes.forEach((s) => svc.scopes.add(s));
  });

  const now = Date.now();
  const firstEvent = events[0]?.timestamp ?? now;

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: "1.0.0",
      eventCount: events.length,
      timeRange: { from: firstEvent, to: now },
    },
    owaspCoverage: {
      totalCategories: 10,
      activeCategories: owaspDetails.filter((d) => d.status === "active")
        .length,
      score: Math.round(
        ((10 * 0.6 + owaspDetails.filter((d) => d.status === "active").length * 0.4) / 10) * 100
      ),
      details: owaspDetails,
    },
    serviceSummary: Array.from(serviceMap.entries()).map(([service, data]) => ({
      service,
      totalCalls: data.total,
      successRate:
        data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
      riskBreakdown: data.risks,
      scopes: Array.from(data.scopes),
    })),
    anomalyScore: {
      score: anomaly.score,
      recommendation: anomaly.recommendation,
      signals: anomaly.signals.map((s) => ({
        type: s.type,
        severity: s.severity,
        description: s.description,
      })),
    },
    riskTimeline: events.slice(-50).map((e) => ({
      timestamp: e.timestamp,
      riskLevel: e.riskLevel,
      tool: e.tool,
      service: e.service,
    })),
    events,
  };
}
