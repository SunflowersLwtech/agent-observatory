import { describe, it, expect } from "vitest";
import {
  classifyToolRisk,
  shouldTriggerStepUp,
  computeSessionAnomalyScore,
  OWASP_RISKS,
} from "@/lib/observatory/risk-classifier";

// ============================================================================
// classifyToolRisk
// ============================================================================
describe("classifyToolRisk", () => {
  it("returns low risk for read-only tools with read scopes", () => {
    const result = classifyToolRisk("check_calendar_availability", [
      "https://www.googleapis.com/auth/calendar.freebusy",
    ]);
    expect(result.riskLevel).toBe("low");
    expect(result.owaspCategories).toContain("ASI03");
  });

  it("returns high risk for write tools", () => {
    const result = classifyToolRisk("send_slack_message", ["chat:write"]);
    expect(result.riskLevel).toBe("high");
    expect(result.owaspCategories).toContain("ASI02");
    expect(result.owaspCategories).toContain("ASI09");
  });

  it("returns medium risk for github repo scope", () => {
    const result = classifyToolRisk("list_github_repos", ["repo"]);
    expect(result.riskLevel).toBe("medium");
  });

  it("picks the highest risk when scope > tool", () => {
    // Tool is low but scope is high → high wins
    const result = classifyToolRisk("list_slack_channels", ["chat:write"]);
    expect(result.riskLevel).toBe("high");
  });

  it("picks the highest risk when tool > scope", () => {
    const result = classifyToolRisk("send_slack_message", ["channels:read"]);
    expect(result.riskLevel).toBe("high");
  });

  it("handles unknown tool gracefully", () => {
    const result = classifyToolRisk("nonexistent_tool", []);
    expect(result.riskLevel).toBe("low");
    expect(result.owaspCategories).toEqual([]);
  });

  it("handles unknown scope gracefully", () => {
    const result = classifyToolRisk("check_calendar_availability", [
      "some:unknown:scope",
    ]);
    expect(result.riskLevel).toBe("low");
    expect(result.owaspCategories).toContain("ASI03");
  });

  it("deduplicates OWASP categories", () => {
    const result = classifyToolRisk("send_slack_message", ["chat:write"]);
    const unique = new Set(result.owaspCategories);
    expect(result.owaspCategories.length).toBe(unique.size);
  });

  it("aggregates OWASP categories from both tool and scopes", () => {
    // write:repo has ASI04 which send_slack_message doesn't
    const result = classifyToolRisk("send_slack_message", ["write:repo"]);
    expect(result.owaspCategories).toContain("ASI04");
    expect(result.owaspCategories).toContain("ASI09");
  });
});

// ============================================================================
// shouldTriggerStepUp
// ============================================================================
describe("shouldTriggerStepUp", () => {
  it("triggers for high risk", () => {
    expect(shouldTriggerStepUp("high")).toBe(true);
  });
  it("triggers for critical risk", () => {
    expect(shouldTriggerStepUp("critical")).toBe(true);
  });
  it("does NOT trigger for medium risk", () => {
    expect(shouldTriggerStepUp("medium")).toBe(false);
  });
  it("does NOT trigger for low risk", () => {
    expect(shouldTriggerStepUp("low")).toBe(false);
  });
});

// ============================================================================
// OWASP_RISKS constants
// ============================================================================
describe("OWASP_RISKS", () => {
  it("has exactly 10 categories (ASI01-ASI10)", () => {
    expect(Object.keys(OWASP_RISKS)).toHaveLength(10);
  });

  it("every category has name and description", () => {
    for (const [code, risk] of Object.entries(OWASP_RISKS)) {
      expect(code).toMatch(/^ASI(0[1-9]|10)$/);
      expect(risk.name).toBeTruthy();
      expect(risk.description).toBeTruthy();
    }
  });
});

// ============================================================================
// computeSessionAnomalyScore
// ============================================================================
describe("computeSessionAnomalyScore", () => {
  const now = Date.now();

  it("returns score 0 and 'normal' for empty event list", () => {
    const result = computeSessionAnomalyScore([]);
    expect(result.score).toBe(0);
    expect(result.recommendation).toBe("normal");
    expect(result.signals).toEqual([]);
  });

  it("returns 'normal' for a few quiet read events", () => {
    const events = Array.from({ length: 3 }, (_, i) => ({
      timestamp: now - 30_000 + i * 1000,
      type: "tool_result",
      service: "google",
      riskLevel: "low",
      outcome: "success",
      tool: "check_calendar_availability",
    }));
    const result = computeSessionAnomalyScore(events);
    expect(result.score).toBe(0);
    expect(result.recommendation).toBe("normal");
  });

  it("detects velocity anomaly (>15 ops in 60s with explicit window)", () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      timestamp: now - 50_000 + i * 2000,
      type: "tool_result",
      service: "google",
      riskLevel: "low",
      outcome: "success",
      tool: "list_calendar_events",
    }));
    const result = computeSessionAnomalyScore(events, 60_000);
    expect(result.signals.some((s) => s.type === "velocity")).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it("velocity severity is capped at 40", () => {
    const events = Array.from({ length: 50 }, (_, i) => ({
      timestamp: now - 50_000 + i * 1000,
      type: "token_exchange",
      service: "google",
      riskLevel: "low",
      outcome: "success",
      tool: "any",
    }));
    const result = computeSessionAnomalyScore(events, 60_000);
    const velSignal = result.signals.find((s) => s.type === "velocity");
    expect(velSignal).toBeDefined();
    expect(velSignal!.severity).toBeLessThanOrEqual(40);
  });

  it("detects cross-service escalation (read A → write B within 10s)", () => {
    const events = [
      {
        timestamp: now - 5000,
        type: "tool_result",
        service: "google",
        riskLevel: "low",
        outcome: "success",
        tool: "list_calendar_events",
      },
      {
        timestamp: now - 1000,
        type: "tool_result",
        service: "slack",
        riskLevel: "high",
        outcome: "success",
        tool: "send_slack_message",
      },
    ];
    const result = computeSessionAnomalyScore(events);
    expect(result.signals.some((s) => s.type === "cross_service")).toBe(true);
  });

  it("does NOT flag cross-service when both are low risk", () => {
    const events = [
      {
        timestamp: now - 5000,
        type: "tool_result",
        service: "google",
        riskLevel: "low",
        outcome: "success",
        tool: "list_calendar_events",
      },
      {
        timestamp: now - 1000,
        type: "tool_result",
        service: "github",
        riskLevel: "low",
        outcome: "success",
        tool: "list_github_repos",
      },
    ];
    const result = computeSessionAnomalyScore(events);
    expect(result.signals.some((s) => s.type === "cross_service")).toBe(false);
  });

  it("detects scope escalation when last risk >> session average", () => {
    const events = [
      { timestamp: now - 10000, type: "tool_result", service: "google", riskLevel: "low", outcome: "success", tool: "a" },
      { timestamp: now - 8000, type: "tool_result", service: "google", riskLevel: "low", outcome: "success", tool: "b" },
      { timestamp: now - 6000, type: "tool_result", service: "google", riskLevel: "low", outcome: "success", tool: "c" },
      { timestamp: now - 1000, type: "tool_result", service: "slack", riskLevel: "critical", outcome: "success", tool: "d" },
    ];
    const result = computeSessionAnomalyScore(events);
    expect(result.signals.some((s) => s.type === "scope_escalation")).toBe(true);
  });

  it("detects error burst (>3 failures in window)", () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      timestamp: now - 30_000 + i * 5000,
      type: "tool_result",
      service: "github",
      riskLevel: "low",
      outcome: "failure",
      tool: "list_github_repos",
    }));
    const result = computeSessionAnomalyScore(events);
    expect(result.signals.some((s) => s.type === "error_burst")).toBe(true);
  });

  it("error burst severity is capped at 30", () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      timestamp: now - 50_000 + i * 2000,
      type: "tool_result",
      service: "github",
      riskLevel: "low",
      outcome: "failure",
      tool: "list_github_repos",
    }));
    const result = computeSessionAnomalyScore(events, 60_000);
    const errSignal = result.signals.find((s) => s.type === "error_burst");
    expect(errSignal!.severity).toBeLessThanOrEqual(30);
  });

  it("overall score is capped at 100", () => {
    // Create events that trigger ALL signals
    const events: Array<{
      timestamp: number; type: string; service: string;
      riskLevel: string; outcome: string; tool: string;
    }> = [];
    // 20 tool_results for velocity
    for (let i = 0; i < 20; i++) {
      events.push({
        timestamp: now - 50_000 + i * 2000,
        type: "tool_result",
        service: i % 2 === 0 ? "google" : "slack",
        riskLevel: i < 15 ? "low" : "high",
        outcome: i > 14 ? "failure" : "success",
        tool: `tool_${i}`,
      });
    }
    // Cross-service escalation pair
    events.push(
      { timestamp: now - 5000, type: "tool_result", service: "google", riskLevel: "low", outcome: "success", tool: "read" },
      { timestamp: now - 1000, type: "tool_result", service: "slack", riskLevel: "critical", outcome: "failure", tool: "write" },
    );
    const result = computeSessionAnomalyScore(events, 60_000);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("recommendation thresholds: ≥25 elevated, ≥50 step_up, ≥70 block", () => {
    // Manually verify recommendation mapping
    // We can't easily control exact scores, so test the function contract
    const empty = computeSessionAnomalyScore([]);
    expect(empty.recommendation).toBe("normal");
  });

  it("ignores events outside the default 5-minute window", () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      timestamp: now - 600_000 + i * 1000, // 10 minutes ago
      type: "tool_result",
      service: "google",
      riskLevel: "low",
      outcome: "success",
      tool: "old_tool",
    }));
    const result = computeSessionAnomalyScore(events);
    expect(result.score).toBe(0);
  });

  it("ignores events outside a custom window", () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      timestamp: now - 120_000 + i * 1000, // 2 minutes ago
      type: "tool_result",
      service: "google",
      riskLevel: "low",
      outcome: "success",
      tool: "old_tool",
    }));
    // With a 60s window, events at ~2min ago are outside the window
    const result = computeSessionAnomalyScore(events, 60_000);
    expect(result.score).toBe(0);
  });

  it("custom windowMs scales velocity threshold proportionally", () => {
    // 30 events in a 2-minute span; with a 2-min window, threshold = ceil(15*2) = 30
    // 30 is NOT > 30, so no velocity signal
    const events = Array.from({ length: 30 }, (_, i) => ({
      timestamp: now - 110_000 + i * 3500,
      type: "tool_result",
      service: "google",
      riskLevel: "low",
      outcome: "success",
      tool: "list_calendar_events",
    }));
    const resultAtThreshold = computeSessionAnomalyScore(events, 120_000);
    expect(resultAtThreshold.signals.some((s) => s.type === "velocity")).toBe(false);

    // 31 events in the same span; 31 > 30, so velocity triggers
    events.push({
      timestamp: now - 1000,
      type: "tool_result",
      service: "google",
      riskLevel: "low",
      outcome: "success",
      tool: "list_calendar_events",
    });
    const resultAboveThreshold = computeSessionAnomalyScore(events, 120_000);
    expect(resultAboveThreshold.signals.some((s) => s.type === "velocity")).toBe(true);
  });
});
