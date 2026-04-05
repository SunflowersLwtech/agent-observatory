/**
 * E2E tests for the chat → tool → observatory flow.
 *
 * These tests simulate what happens when the chat API route processes
 * tool calls and events flow through the observatory pipeline.
 *
 * NOTE: These tests use mocked external services (OpenAI, Google, etc.)
 * but exercise the REAL internal pipeline:
 *   recordEvent → getEvents → getEventStats → computeAnomalyScore → generateReport
 *
 * When Auth0 env vars are configured, additional live tests can be enabled
 * by setting E2E_LIVE=true.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordEvent,
  getEvents,
  getEventStats,
  updateTokenState,
  getTokenStates,
  getCorrelatedEvents,
} from "@/lib/observatory/event-store";
import { classifyToolRisk } from "@/lib/observatory/risk-classifier";
import { generateReport } from "@/lib/observatory/report-generator";
import {
  initializeUserPermissions,
  canAccessService,
  denyScopeForUser,
  isScopeDenied,
} from "@/lib/fga/model";

describe("E2E: Chat → Tool → Observatory pipeline", () => {
  const userId = "e2e-user-1";

  beforeEach(() => {
    initializeUserPermissions(userId);
  });

  it("simulates a full Google Calendar read flow", () => {
    // Step 1: FGA check
    expect(canAccessService(userId, "google-calendar")).toBe(true);

    // Step 2: Token exchange
    const { riskLevel, owaspCategories } = classifyToolRisk(
      "check_calendar_availability",
      ["https://www.googleapis.com/auth/calendar.freebusy"]
    );
    expect(riskLevel).toBe("low");

    recordEvent({
      type: "token_exchange",
      tool: "check_calendar_availability",
      service: "google",
      scopes: ["https://www.googleapis.com/auth/calendar.freebusy"],
      riskLevel,
      owaspCategories,
      outcome: "success",
      details: { pattern: "Token Vault Exchange" },
    });

    // Step 3: Tool execution result
    recordEvent({
      type: "tool_result",
      tool: "check_calendar_availability",
      service: "google",
      scopes: ["https://www.googleapis.com/auth/calendar.freebusy"],
      riskLevel,
      owaspCategories,
      outcome: "success",
      details: { busySlots: 3 },
    });

    // Step 4: Token state update
    updateTokenState("google", {
      service: "google",
      connection: "google-oauth2",
      status: "connected",
      healthScore: 95,
      scopes: ["calendar.freebusy"],
      lastExchanged: Date.now(),
    });

    // Verify observatory state
    const events = getEvents();
    expect(events).toHaveLength(2);

    const stats = getEventStats();
    expect(stats.byService.google).toBe(2);
    expect(stats.byOutcome.success).toBe(2);

    const states = getTokenStates();
    const googleState = states.find((s) => s.service === "google");
    expect(googleState?.status).toBe("connected");

    // Correlation should link the exchange to the tool result
    const pairs = getCorrelatedEvents("google");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].toolCalls).toHaveLength(1);
  });

  it("simulates a high-risk Slack write with step-up", () => {
    // Step 1: Classify risk
    const { riskLevel } = classifyToolRisk("send_slack_message", ["chat:write"]);
    expect(riskLevel).toBe("high");

    // Step 2: Step-up triggered
    recordEvent({
      type: "step_up_triggered",
      tool: "confirmHighRiskOperation",
      service: "slack",
      scopes: [],
      riskLevel: "high",
      owaspCategories: ["ASI09"],
      outcome: "success",
      details: { operation: "Send message", pattern: "Pattern 3" },
    });

    // Step 3: User does NOT approve → tool_result with interrupted outcome
    recordEvent({
      type: "tool_result",
      tool: "send_slack_message",
      service: "slack",
      scopes: ["chat:write"],
      riskLevel: "high",
      owaspCategories: ["ASI02", "ASI09"],
      outcome: "interrupted",
      details: { reason: "User declined" },
    });

    const events = getEvents();
    const interrupted = events.filter((e) => e.outcome === "interrupted");
    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].tool).toBe("send_slack_message");
  });

  it("simulates multi-service flow: Google → GitHub → Slack", () => {
    // Google read
    recordEvent({
      type: "token_exchange", tool: "list_calendar_events", service: "google",
      scopes: ["calendar.events.readonly"], riskLevel: "low",
      owaspCategories: ["ASI03"], outcome: "success", details: {},
    });
    recordEvent({
      type: "tool_result", tool: "list_calendar_events", service: "google",
      scopes: [], riskLevel: "low",
      owaspCategories: ["ASI03"], outcome: "success", details: {},
    });

    // GitHub read
    recordEvent({
      type: "token_exchange", tool: "list_github_repos", service: "github",
      scopes: ["repo"], riskLevel: "medium",
      owaspCategories: ["ASI02", "ASI03"], outcome: "success", details: {},
    });
    recordEvent({
      type: "tool_result", tool: "list_github_repos", service: "github",
      scopes: [], riskLevel: "medium",
      owaspCategories: ["ASI03"], outcome: "success", details: {},
    });

    // Slack read
    recordEvent({
      type: "token_exchange", tool: "list_slack_channels", service: "slack",
      scopes: ["channels:read"], riskLevel: "low",
      owaspCategories: ["ASI03"], outcome: "success", details: {},
    });
    recordEvent({
      type: "tool_result", tool: "list_slack_channels", service: "slack",
      scopes: [], riskLevel: "low",
      owaspCategories: ["ASI03"], outcome: "success", details: {},
    });

    // Full report
    const report = generateReport();
    expect(report.metadata.eventCount).toBe(6);
    expect(report.serviceSummary).toHaveLength(3);
    expect(report.owaspCoverage.activeCategories).toBeGreaterThan(0);
  });

  it("scope denial blocks operation in pipeline", () => {
    denyScopeForUser(userId, "slack", "chat:write");
    expect(isScopeDenied(userId, "slack", "chat:write")).toBe(true);

    // Simulates what the tool would do: check → deny → record failure
    recordEvent({
      type: "authorization_decision",
      tool: "send_slack_message",
      service: "slack",
      scopes: ["chat:write"],
      riskLevel: "high",
      owaspCategories: ["ASI03"],
      outcome: "failure",
      details: { reason: "Scope denied by user" },
    });

    const events = getEvents({ riskLevel: "high" });
    expect(events.some((e) => e.outcome === "failure")).toBe(true);
  });

  it("error flow: token exchange failure → observatory records it", () => {
    recordEvent({
      type: "token_exchange",
      tool: "list_github_repos",
      service: "github",
      scopes: ["repo"],
      riskLevel: "medium",
      owaspCategories: ["ASI03"],
      outcome: "failure",
      details: { error: "Federated connection Refresh Token not found" },
    });

    updateTokenState("github", {
      service: "github",
      connection: "github",
      status: "error",
      healthScore: 0,
      errorMessage: "Federated connection Refresh Token not found",
    });

    const states = getTokenStates();
    const gh = states.find((s) => s.service === "github");
    expect(gh?.status).toBe("error");
    expect(gh?.errorMessage).toContain("Refresh Token not found");
  });
});

// ============================================================================
// Live E2E (only when ENV is configured)
// ============================================================================
const isLive = process.env.E2E_LIVE === "true" &&
  process.env.AUTH0_CLIENT_ID &&
  process.env.AUTH0_CLIENT_ID !== "test-client-id";

describe.skipIf(!isLive)("E2E Live: requires configured Auth0 tenant", () => {
  it("placeholder — enable with E2E_LIVE=true and real credentials", () => {
    expect(isLive).toBe(true);
  });
});
