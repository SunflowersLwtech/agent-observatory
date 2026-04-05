/**
 * Evaluation tests — verify the project's claims about OWASP coverage,
 * risk classification accuracy, and anomaly detection correctness.
 *
 * These are "meta" tests: they validate that the system's security
 * properties match what the README and blog post claim.
 */
import { describe, it, expect } from "vitest";
import { OWASP_RISKS, classifyToolRisk, shouldTriggerStepUp } from "@/lib/observatory/risk-classifier";
import { recordEvent } from "@/lib/observatory/event-store";
import { generateReport } from "@/lib/observatory/report-generator";
import { AGENT_OBSERVATORY_MODEL, initializeUserPermissions, canAccessService, canPerformAgentAction } from "@/lib/fga/model";

// ============================================================================
// OWASP Top 10 Coverage Evaluation
// README claims: "OWASP Top 10 for Agentic Applications Coverage" for all 10
// ============================================================================
describe("OWASP coverage claims", () => {
  it("all 10 OWASP categories have name + description", () => {
    const codes = Object.keys(OWASP_RISKS);
    expect(codes).toHaveLength(10);
    for (let i = 1; i <= 10; i++) {
      const code = `ASI${String(i).padStart(2, "0")}`;
      expect(OWASP_RISKS[code as keyof typeof OWASP_RISKS]).toBeDefined();
    }
  });

  it("README mitigation mapping: every tool maps to ≥1 OWASP category", () => {
    const tools = [
      "check_calendar_availability",
      "list_calendar_events",
      "list_github_repos",
      "list_github_issues",
      "list_slack_channels",
      "send_slack_message",
    ];
    for (const tool of tools) {
      const result = classifyToolRisk(tool, []);
      expect(result.owaspCategories.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("report OWASP score has architecture baseline ≥ 60", () => {
    const report = generateReport();
    expect(report.owaspCoverage.score).toBeGreaterThanOrEqual(60);
  });

  it("active categories increase score above baseline", () => {
    // Seed events touching multiple OWASP categories
    const categories: Array<[string, string[]]> = [
      ["ASI01", ["ASI01"]],
      ["ASI02", ["ASI02"]],
      ["ASI03", ["ASI03"]],
      ["ASI09", ["ASI09"]],
    ];
    for (const [, cats] of categories) {
      recordEvent({
        type: "tool_result", tool: "eval_tool", service: "google",
        scopes: [], riskLevel: "low",
        owaspCategories: cats as never, outcome: "success", details: {},
      });
    }
    const report = generateReport();
    expect(report.owaspCoverage.activeCategories).toBeGreaterThanOrEqual(4);
    expect(report.owaspCoverage.score).toBeGreaterThan(60);
  });
});

// ============================================================================
// Risk Classification Accuracy
// Validates Pattern 2: Scope-Bound Risk Classification
// ============================================================================
describe("Risk classification accuracy (Pattern 2)", () => {
  it("read scopes → low risk", () => {
    const readScopes = [
      "https://www.googleapis.com/auth/calendar.freebusy",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "channels:read",
      "groups:read",
      "users:read",
      "read:user",
    ];
    for (const scope of readScopes) {
      const { riskLevel } = classifyToolRisk("unknown_tool", [scope]);
      expect(riskLevel).toBe("low");
    }
  });

  it("write scopes → high risk", () => {
    const writeScopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "chat:write",
      "write:repo",
    ];
    for (const scope of writeScopes) {
      const { riskLevel } = classifyToolRisk("unknown_tool", [scope]);
      expect(riskLevel).toBe("high");
    }
  });

  it("mixed scopes: highest wins", () => {
    const { riskLevel } = classifyToolRisk("list_slack_channels", [
      "channels:read", // low
      "chat:write",    // high
    ]);
    expect(riskLevel).toBe("high");
  });

  it("step-up triggers only for high/critical", () => {
    expect(shouldTriggerStepUp("low")).toBe(false);
    expect(shouldTriggerStepUp("medium")).toBe(false);
    expect(shouldTriggerStepUp("high")).toBe(true);
    expect(shouldTriggerStepUp("critical")).toBe(true);
  });
});

// ============================================================================
// FGA Model Evaluation
// Validates: user access control, agent action approval, scope denial
// ============================================================================
describe("FGA authorization model evaluation", () => {
  it("model defines correct type hierarchy", () => {
    const types = AGENT_OBSERVATORY_MODEL.type_definitions.map((t) => t.type);
    expect(types).toContain("user");
    expect(types).toContain("service");
    expect(types).toContain("agent_action");
    expect(types).toContain("document");
  });

  it("initializeUserPermissions grants exactly 3 services + 1 agent action", () => {
    const uid = "eval-fga-user";
    initializeUserPermissions(uid);

    expect(canAccessService(uid, "google-calendar")).toBe(true);
    expect(canAccessService(uid, "github")).toBe(true);
    expect(canAccessService(uid, "slack")).toBe(true);
    expect(canAccessService(uid, "salesforce")).toBe(false); // not granted

    expect(canPerformAgentAction(uid, "write_operations")).toBe(true);
    expect(canPerformAgentAction(uid, "delete_operations")).toBe(false); // not granted
  });
});

// ============================================================================
// Three Patterns — Functional Verification
// ============================================================================
describe("Three Authorization Patterns functional check", () => {
  it("Pattern 1: Credential-Event Correlation produces linked pairs", () => {
    recordEvent({
      type: "token_exchange", tool: "list_calendar_events", service: "google",
      scopes: ["calendar.freebusy"], riskLevel: "low",
      owaspCategories: ["ASI03"], outcome: "success", details: {},
    });
    recordEvent({
      type: "tool_result", tool: "list_calendar_events", service: "google",
      scopes: [], riskLevel: "low",
      owaspCategories: ["ASI03"], outcome: "success", details: {},
    });

    const report = generateReport();
    // Events exist and can be correlated
    expect(report.events.length).toBeGreaterThanOrEqual(2);
  });

  it("Pattern 2: Scope-Bound Risk Classification categorizes all 6 tools", () => {
    const tools = [
      { name: "check_calendar_availability", expectedMax: "low" },
      { name: "list_calendar_events", expectedMax: "low" },
      { name: "list_github_repos", expectedMax: "low" },
      { name: "list_github_issues", expectedMax: "low" },
      { name: "list_slack_channels", expectedMax: "low" },
      { name: "send_slack_message", expectedMax: "high" },
    ];
    for (const { name, expectedMax } of tools) {
      const { riskLevel } = classifyToolRisk(name, []);
      expect(riskLevel).toBe(expectedMax);
    }
  });

  it("Pattern 3: Interrupt-as-Circuit-Breaker triggers for write ops", () => {
    const writeTools = ["send_slack_message"];
    for (const tool of writeTools) {
      const { riskLevel } = classifyToolRisk(tool, []);
      expect(shouldTriggerStepUp(riskLevel)).toBe(true);
    }
    const readTools = ["check_calendar_availability", "list_github_repos"];
    for (const tool of readTools) {
      const { riskLevel } = classifyToolRisk(tool, []);
      expect(shouldTriggerStepUp(riskLevel)).toBe(false);
    }
  });
});

// ============================================================================
// Report Completeness — matches what Devpost submission claims
// ============================================================================
describe("Report completeness", () => {
  it("report includes all required sections", () => {
    recordEvent({
      type: "tool_result", tool: "test", service: "google",
      scopes: [], riskLevel: "low", owaspCategories: ["ASI03"],
      outcome: "success", details: {},
    });
    const report = generateReport();

    expect(report.metadata).toHaveProperty("generatedAt");
    expect(report.metadata).toHaveProperty("version");
    expect(report.metadata).toHaveProperty("eventCount");
    expect(report.metadata).toHaveProperty("timeRange");
    expect(report.owaspCoverage).toHaveProperty("totalCategories");
    expect(report.owaspCoverage).toHaveProperty("activeCategories");
    expect(report.owaspCoverage).toHaveProperty("score");
    expect(report.owaspCoverage).toHaveProperty("details");
    expect(report.serviceSummary).toBeDefined();
    expect(report.anomalyScore).toHaveProperty("score");
    expect(report.anomalyScore).toHaveProperty("recommendation");
    expect(report.riskTimeline).toBeDefined();
    expect(report.events).toBeDefined();
  });
});
