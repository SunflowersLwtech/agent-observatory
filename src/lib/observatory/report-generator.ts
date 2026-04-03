import {
  getEvents,
  getEventStats,
  getTokenStates,
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
  const stats = getEventStats();
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

export function generateMarkdownReport(): string {
  const report = generateReport();
  const lines: string[] = [];

  lines.push("# Agent Observatory — Audit Report");
  lines.push("");
  lines.push(`Generated: ${report.metadata.generatedAt}`);
  lines.push(`Events: ${report.metadata.eventCount}`);
  lines.push("");

  lines.push("## OWASP Agentic Top 10 Coverage");
  lines.push("");
  lines.push(`Score: ${report.owaspCoverage.score}/100 (${report.owaspCoverage.activeCategories}/10 categories active)`);
  lines.push("");
  lines.push("| Code | Risk | Events | Status |");
  lines.push("|------|------|--------|--------|");
  report.owaspCoverage.details.forEach((d) => {
    lines.push(`| ${d.code} | ${d.name} | ${d.eventCount} | ${d.status} |`);
  });
  lines.push("");

  lines.push("## Service Summary");
  lines.push("");
  report.serviceSummary.forEach((svc) => {
    lines.push(`### ${svc.service}`);
    lines.push(`- Total calls: ${svc.totalCalls}`);
    lines.push(`- Success rate: ${svc.successRate}%`);
    lines.push(`- Scopes: ${svc.scopes.join(", ") || "none"}`);
    lines.push("");
  });

  lines.push("## Anomaly Detection");
  lines.push("");
  lines.push(`Score: ${report.anomalyScore.score}/100 (${report.anomalyScore.recommendation})`);
  if (report.anomalyScore.signals.length > 0) {
    lines.push("");
    report.anomalyScore.signals.forEach((s) => {
      lines.push(`- [${s.type}] ${s.description} (severity: ${s.severity})`);
    });
  }
  lines.push("");

  return lines.join("\n");
}
