import { describe, it, expect } from "vitest";
import { computeSessionAnomalyScore } from "@/lib/observatory/risk-classifier";

describe("Anomaly detection under stress", () => {
  const now = Date.now();

  it("handles 10,000 events without error", () => {
    const events = Array.from({ length: 10_000 }, (_, i) => ({
      timestamp: now - 60_000 + (i % 60) * 1000,
      type: "tool_result",
      service: "google",
      riskLevel: "low",
      outcome: "success",
      tool: `tool_${i}`,
    }));
    expect(() => computeSessionAnomalyScore(events)).not.toThrow();
  });

  it("execution time is reasonable for 10,000 events (< 500ms)", () => {
    const events = Array.from({ length: 10_000 }, (_, i) => ({
      timestamp: now - 60_000 + (i % 60) * 1000,
      type: "tool_result",
      service: "google",
      riskLevel: "low",
      outcome: "success",
      tool: `tool_${i}`,
    }));
    const start = performance.now();
    computeSessionAnomalyScore(events);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("all signal severities stay within documented bounds", () => {
    // Craft events that trigger all 4 signals at maximum
    const events: Array<{
      timestamp: number; type: string; service: string;
      riskLevel: string; outcome: string; tool: string;
    }> = [];
    // 50 rapid tool calls for velocity
    for (let i = 0; i < 50; i++) {
      events.push({
        timestamp: now - 50_000 + i * 1000,
        type: "tool_result",
        service: i % 2 === 0 ? "google" : "slack",
        riskLevel: i < 40 ? "low" : "critical",
        outcome: i > 40 ? "failure" : "success",
        tool: `stress_${i}`,
      });
    }
    // Cross-service pair
    events.push(
      { timestamp: now - 3000, type: "tool_result", service: "google", riskLevel: "low", outcome: "success", tool: "read" },
      { timestamp: now - 1000, type: "tool_result", service: "slack", riskLevel: "critical", outcome: "failure", tool: "write" },
    );

    const result = computeSessionAnomalyScore(events);

    // Verify severity bounds
    for (const signal of result.signals) {
      expect(signal.severity).toBeGreaterThanOrEqual(0);
      if (signal.type === "velocity") expect(signal.severity).toBeLessThanOrEqual(40);
      if (signal.type === "cross_service") expect(signal.severity).toBe(35);
      if (signal.type === "scope_escalation") expect(signal.severity).toBe(25);
      if (signal.type === "error_burst") expect(signal.severity).toBeLessThanOrEqual(30);
    }

    // Score capped at 100
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("recommendation is always one of the 4 valid values", () => {
    const validRecs = ["normal", "elevated", "step_up_required", "block"];
    for (let eventCount = 0; eventCount <= 100; eventCount += 10) {
      const events = Array.from({ length: eventCount }, (_, i) => ({
        timestamp: now - 30_000 + i * 500,
        type: "tool_result",
        service: "google",
        riskLevel: eventCount > 50 ? "high" : "low",
        outcome: eventCount > 70 ? "failure" : "success",
        tool: `rec_${i}`,
      }));
      const result = computeSessionAnomalyScore(events);
      expect(validRecs).toContain(result.recommendation);
    }
  });
});
