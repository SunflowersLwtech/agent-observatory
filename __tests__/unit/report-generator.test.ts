import { describe, it, expect } from "vitest";
import { recordEvent } from "@/lib/observatory/event-store";
import {
  generateReport,
} from "@/lib/observatory/report-generator";

function seedEvents() {
  recordEvent({
    type: "token_exchange", tool: "list_calendar_events", service: "google",
    scopes: ["calendar.freebusy"], riskLevel: "low",
    owaspCategories: ["ASI03"], outcome: "success", details: {},
  });
  recordEvent({
    type: "tool_result", tool: "list_calendar_events", service: "google",
    scopes: ["calendar.freebusy"], riskLevel: "low",
    owaspCategories: ["ASI03"], outcome: "success", details: {},
  });
  recordEvent({
    type: "tool_result", tool: "send_slack_message", service: "slack",
    scopes: ["chat:write"], riskLevel: "high",
    owaspCategories: ["ASI02", "ASI09"], outcome: "failure", details: {},
  });
  recordEvent({
    type: "step_up_triggered", tool: "confirmHighRiskOperation", service: "slack",
    scopes: [], riskLevel: "high",
    owaspCategories: ["ASI09"], outcome: "success", details: {},
  });
}

// ============================================================================
// generateReport
// ============================================================================
describe("generateReport", () => {
  it("returns valid report structure with no events", () => {
    const report = generateReport();
    expect(report.metadata.version).toBe("1.0.0");
    expect(report.metadata.eventCount).toBe(0);
    expect(report.owaspCoverage.totalCategories).toBe(10);
    expect(report.serviceSummary).toEqual([]);
    expect(report.anomalyScore.recommendation).toBe("normal");
  });

  it("report reflects seeded events accurately", () => {
    seedEvents();
    const report = generateReport();

    expect(report.metadata.eventCount).toBe(4);
    expect(report.owaspCoverage.activeCategories).toBeGreaterThan(0);

    // Service summary
    const google = report.serviceSummary.find((s) => s.service === "google");
    expect(google).toBeDefined();
    expect(google!.totalCalls).toBe(2);
    expect(google!.successRate).toBe(100);

    const slack = report.serviceSummary.find((s) => s.service === "slack");
    expect(slack).toBeDefined();
    expect(slack!.successRate).toBe(50); // 1 success, 1 failure
  });

  it("OWASP coverage score includes architecture baseline of 60%", () => {
    // With 0 events, activeCategories = 0
    // Score = round(((10 * 0.6 + 0 * 0.4) / 10) * 100) = 60
    const report = generateReport();
    expect(report.owaspCoverage.score).toBe(60);
  });

  it("OWASP coverage score increases with active categories", () => {
    seedEvents();
    const report = generateReport();
    // With active categories > 0, score should be > 60
    expect(report.owaspCoverage.score).toBeGreaterThan(60);
  });

  it("riskTimeline contains at most 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      recordEvent({
        type: "tool_result", tool: `tool_${i}`, service: "google",
        scopes: [], riskLevel: "low", owaspCategories: ["ASI03"],
        outcome: "success", details: {},
      });
    }
    const report = generateReport();
    expect(report.riskTimeline.length).toBeLessThanOrEqual(50);
  });

  it("timeRange is sensible", () => {
    seedEvents();
    const report = generateReport();
    expect(report.metadata.timeRange.from).toBeLessThanOrEqual(
      report.metadata.timeRange.to
    );
  });
});

