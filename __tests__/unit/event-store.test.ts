import { describe, it, expect, beforeEach } from "vitest";
import {
  recordEvent,
  getEvents,
  getEventStats,
  clearEvents,
  updateTokenState,
  getTokenStates,
  generateEventId,
  getCorrelatedEvents,
  type ObservatoryEvent,
} from "@/lib/observatory/event-store";

function makeEvent(overrides: Partial<Omit<ObservatoryEvent, "id" | "timestamp">> = {}) {
  return {
    type: "tool_result" as const,
    tool: "test_tool",
    service: "google",
    scopes: ["calendar.freebusy"],
    riskLevel: "low" as const,
    owaspCategories: ["ASI03" as const],
    outcome: "success" as const,
    details: {},
    ...overrides,
  };
}

// ============================================================================
// recordEvent & getEvents
// ============================================================================
describe("recordEvent", () => {
  it("records an event and returns it with id and timestamp", () => {
    const event = recordEvent(makeEvent());
    expect(event.id).toMatch(/^evt_/);
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.tool).toBe("test_tool");
  });

  it("assigns unique ids to consecutive events", () => {
    const a = recordEvent(makeEvent());
    const b = recordEvent(makeEvent());
    expect(a.id).not.toBe(b.id);
  });
});

describe("getEvents", () => {
  it("returns empty array when no events exist", () => {
    expect(getEvents()).toEqual([]);
  });

  it("returns recorded events in order", () => {
    recordEvent(makeEvent({ service: "google" }));
    recordEvent(makeEvent({ service: "github" }));
    recordEvent(makeEvent({ service: "slack" }));
    const events = getEvents();
    expect(events).toHaveLength(3);
    expect(events[0].service).toBe("google");
    expect(events[2].service).toBe("slack");
  });

  it("filters by type", () => {
    recordEvent(makeEvent({ type: "tool_result" }));
    recordEvent(makeEvent({ type: "token_exchange" }));
    recordEvent(makeEvent({ type: "tool_result" }));
    expect(getEvents({ type: "token_exchange" })).toHaveLength(1);
  });

  it("filters by service", () => {
    recordEvent(makeEvent({ service: "google" }));
    recordEvent(makeEvent({ service: "github" }));
    expect(getEvents({ service: "github" })).toHaveLength(1);
  });

  it("filters by riskLevel", () => {
    recordEvent(makeEvent({ riskLevel: "low" }));
    recordEvent(makeEvent({ riskLevel: "high" }));
    recordEvent(makeEvent({ riskLevel: "low" }));
    expect(getEvents({ riskLevel: "high" })).toHaveLength(1);
  });

  it("filters by since timestamp", () => {
    recordEvent(makeEvent()); // seed an older event
    // Simulate a newer event by recording another
    const newer = recordEvent(makeEvent());
    const result = getEvents({ since: newer.timestamp });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((e) => e.timestamp >= newer.timestamp)).toBe(true);
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 10; i++) recordEvent(makeEvent());
    expect(getEvents({ limit: 3 })).toHaveLength(3);
  });

  it("limit returns the LAST N events (tail)", () => {
    for (let i = 0; i < 5; i++) recordEvent(makeEvent({ tool: `tool_${i}` }));
    const last2 = getEvents({ limit: 2 });
    expect(last2[0].tool).toBe("tool_3");
    expect(last2[1].tool).toBe("tool_4");
  });

  it("combines multiple filters", () => {
    recordEvent(makeEvent({ service: "google", riskLevel: "low" }));
    recordEvent(makeEvent({ service: "google", riskLevel: "high" }));
    recordEvent(makeEvent({ service: "github", riskLevel: "high" }));
    const result = getEvents({ service: "google", riskLevel: "high" });
    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// clearEvents
// ============================================================================
describe("clearEvents", () => {
  it("removes all events", () => {
    recordEvent(makeEvent());
    recordEvent(makeEvent());
    clearEvents();
    expect(getEvents()).toEqual([]);
  });
});

// ============================================================================
// getEventStats
// ============================================================================
describe("getEventStats", () => {
  it("returns zeroes when empty", () => {
    const stats = getEventStats();
    expect(stats.total).toBe(0);
    expect(stats.recent).toBe(0);
    expect(stats.byRisk.low).toBe(0);
  });

  it("counts events by risk level", () => {
    recordEvent(makeEvent({ riskLevel: "low" }));
    recordEvent(makeEvent({ riskLevel: "low" }));
    recordEvent(makeEvent({ riskLevel: "high" }));
    const stats = getEventStats();
    expect(stats.byRisk.low).toBe(2);
    expect(stats.byRisk.high).toBe(1);
  });

  it("counts events by service", () => {
    recordEvent(makeEvent({ service: "google" }));
    recordEvent(makeEvent({ service: "github" }));
    recordEvent(makeEvent({ service: "github" }));
    const stats = getEventStats();
    expect(stats.byService.google).toBe(1);
    expect(stats.byService.github).toBe(2);
  });

  it("counts events by outcome", () => {
    recordEvent(makeEvent({ outcome: "success" }));
    recordEvent(makeEvent({ outcome: "failure" }));
    recordEvent(makeEvent({ outcome: "interrupted" }));
    const stats = getEventStats();
    expect(stats.byOutcome.success).toBe(1);
    expect(stats.byOutcome.failure).toBe(1);
    expect(stats.byOutcome.interrupted).toBe(1);
  });
});

// ============================================================================
// Token state management
// ============================================================================
describe("Token state management", () => {
  it("updates and retrieves token states", () => {
    updateTokenState("google", {
      service: "google",
      connection: "google-oauth2",
      status: "connected",
      healthScore: 85,
      scopes: ["calendar.freebusy"],
    });
    const states = getTokenStates();
    expect(states).toHaveLength(1);
    expect(states[0].service).toBe("google");
    expect(states[0].healthScore).toBe(85);
  });

  it("merges updates into existing state", () => {
    updateTokenState("google", {
      service: "google",
      connection: "google-oauth2",
      status: "connected",
      healthScore: 85,
    });
    updateTokenState("google", {
      service: "google",
      connection: "google-oauth2",
      healthScore: 50,
      errorMessage: "Token expired",
    });
    const states = getTokenStates();
    expect(states).toHaveLength(1);
    expect(states[0].healthScore).toBe(50);
    expect(states[0].errorMessage).toBe("Token expired");
    expect(states[0].status).toBe("connected"); // preserved from first update
  });

  it("manages multiple services independently", () => {
    updateTokenState("google", { service: "google", connection: "google-oauth2", status: "connected", healthScore: 90 });
    updateTokenState("github", { service: "github", connection: "github", status: "disconnected", healthScore: 0 });
    const states = getTokenStates();
    expect(states).toHaveLength(2);
  });
});

// ============================================================================
// generateEventId
// ============================================================================
describe("generateEventId", () => {
  it("produces unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEventId()));
    expect(ids.size).toBe(100);
  });

  it("starts with evt_ prefix", () => {
    expect(generateEventId()).toMatch(/^evt_\d+_\d+$/);
  });
});

// ============================================================================
// User isolation (security fix)
// ============================================================================
describe("User isolation", () => {
  beforeEach(() => {
    clearEvents();
  });

  it("getEvents filters by userId when provided", () => {
    recordEvent(makeEvent({ service: "google", userId: "user1" }));
    recordEvent(makeEvent({ service: "github", userId: "user2" }));
    recordEvent(makeEvent({ service: "slack", userId: "user1" }));
    const user1Events = getEvents({ userId: "user1" });
    expect(user1Events).toHaveLength(2);
    expect(user1Events.every((e) => e.userId === "user1")).toBe(true);
  });

  it("getEvents returns all events when userId is omitted (backward compat)", () => {
    recordEvent(makeEvent({ userId: "user1" }));
    recordEvent(makeEvent({ userId: "user2" }));
    recordEvent(makeEvent()); // no userId
    const all = getEvents();
    expect(all).toHaveLength(3);
  });

  it("getEventStats scopes to userId when provided", () => {
    recordEvent(makeEvent({ riskLevel: "low", userId: "user1" }));
    recordEvent(makeEvent({ riskLevel: "high", userId: "user1" }));
    recordEvent(makeEvent({ riskLevel: "high", userId: "user2" }));
    const stats = getEventStats("user1");
    expect(stats.total).toBe(2);
    expect(stats.byRisk.high).toBe(1);
  });

  it("getCorrelatedEvents scopes to userId when provided", () => {
    recordEvent(makeEvent({ type: "token_exchange", tool: "t1", service: "google", userId: "user1" }));
    recordEvent(makeEvent({ type: "tool_result", tool: "t1", service: "google", userId: "user1" }));
    recordEvent(makeEvent({ type: "token_exchange", tool: "t2", service: "google", userId: "user2" }));
    const pairs = getCorrelatedEvents(undefined, undefined, "user1");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].tokenExchange.userId).toBe("user1");
  });

  it("getTokenStates scopes to userId when provided", () => {
    updateTokenState("google", { service: "google", connection: "google-oauth2", status: "connected", healthScore: 90 }, "user1");
    updateTokenState("github", { service: "github", connection: "github", status: "connected", healthScore: 80 }, "user2");
    const user1States = getTokenStates("user1");
    expect(user1States).toHaveLength(1);
    expect(user1States[0].service).toBe("google");
  });
});

// ============================================================================
// Credential-Event Correlation (Pattern 1)
// ============================================================================
describe("getCorrelatedEvents", () => {
  it("returns empty array when no token_exchange events exist", () => {
    recordEvent(makeEvent({ type: "tool_result" }));
    expect(getCorrelatedEvents()).toEqual([]);
  });

  it("correlates a token_exchange with its subsequent tool_result", () => {
    const exchange = recordEvent(makeEvent({
      type: "token_exchange",
      tool: "list_calendar_events",
      service: "google",
    }));
    const toolResult = recordEvent(makeEvent({
      type: "tool_result",
      tool: "list_calendar_events",
      service: "google",
    }));
    const pairs = getCorrelatedEvents();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].tokenExchange.id).toBe(exchange.id);
    expect(pairs[0].toolCalls).toHaveLength(1);
    expect(pairs[0].toolCalls[0].id).toBe(toolResult.id);
  });

  it("does NOT correlate events from different services", () => {
    recordEvent(makeEvent({ type: "token_exchange", tool: "list_calendar_events", service: "google" }));
    recordEvent(makeEvent({ type: "tool_result", tool: "list_github_repos", service: "github" }));
    const pairs = getCorrelatedEvents();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].toolCalls).toHaveLength(0);
  });

  it("filters correlations by service", () => {
    recordEvent(makeEvent({ type: "token_exchange", tool: "t1", service: "google" }));
    recordEvent(makeEvent({ type: "token_exchange", tool: "t2", service: "github" }));
    const googleOnly = getCorrelatedEvents("google");
    expect(googleOnly).toHaveLength(1);
    expect(googleOnly[0].tokenExchange.service).toBe("google");
  });
});
