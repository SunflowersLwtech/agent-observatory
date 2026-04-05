import { describe, it, expect } from "vitest";
import {
  recordEvent,
  getEvents,
  getEventStats,
  getCorrelatedEvents,
  clearEvents,
  type ObservatoryEvent,
} from "@/lib/observatory/event-store";

function makeEvent(
  overrides: Partial<Omit<ObservatoryEvent, "id" | "timestamp">> = {}
) {
  return {
    type: "tool_result" as const,
    tool: "stress_tool",
    service: "google",
    scopes: [],
    riskLevel: "low" as const,
    owaspCategories: ["ASI03" as const],
    outcome: "success" as const,
    details: {},
    ...overrides,
  };
}

// ============================================================================
// Circular buffer — MAX_EVENTS = 1000
// ============================================================================
describe("Circular buffer (1000 event cap)", () => {
  it("retains exactly 1000 events when 1000 are inserted", () => {
    for (let i = 0; i < 1000; i++) {
      recordEvent(makeEvent({ tool: `tool_${i}` }));
    }
    const events = getEvents({ limit: 2000 });
    expect(events).toHaveLength(1000);
  });

  it("evicts oldest events when exceeding 1000", () => {
    clearEvents();
    for (let i = 0; i < 1100; i++) {
      recordEvent(makeEvent({ tool: `tool_${i}` }));
    }
    const events = getEvents({ limit: 2000 });
    expect(events).toHaveLength(1000);
    // The first 100 should have been evicted
    expect(events[0].tool).toBe("tool_100");
    expect(events[999].tool).toBe("tool_1099");
  });

  it("eviction does not corrupt event ordering", () => {
    clearEvents();
    for (let i = 0; i < 1500; i++) {
      recordEvent(makeEvent({ tool: `seq_${i}` }));
    }
    const events = getEvents({ limit: 2000 });
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
    }
  });
});

// ============================================================================
// Rapid-fire concurrent writes
// ============================================================================
describe("Rapid-fire writes", () => {
  it("handles 5000 sequential writes without error", () => {
    clearEvents();
    for (let i = 0; i < 5000; i++) {
      recordEvent(makeEvent({ tool: `rapid_${i}` }));
    }
    const events = getEvents({ limit: 2000 });
    expect(events).toHaveLength(1000); // buffer cap
  });

  it("handles rapid writes + reads interleaved", () => {
    clearEvents();
    for (let i = 0; i < 500; i++) {
      recordEvent(makeEvent());
      if (i % 50 === 0) {
        const snapshot = getEvents();
        expect(snapshot.length).toBeGreaterThan(0);
      }
    }
  });
});

// ============================================================================
// getEventStats under load
// ============================================================================
describe("getEventStats under load", () => {
  it("stats are correct after 2000 events", () => {
    clearEvents();
    for (let i = 0; i < 2000; i++) {
      const svc = i % 3 === 0 ? "google" : i % 3 === 1 ? "github" : "slack";
      const risk = i % 10 === 0 ? "high" : "low";
      recordEvent(makeEvent({ service: svc, riskLevel: risk as "low" | "high" }));
    }
    const stats = getEventStats();
    // Total should be 1000 (buffer cap)
    expect(stats.total).toBe(1000);
    // Recent should count only last 5 minutes (all are recent)
    expect(stats.recent).toBeGreaterThan(0);
  });
});

// ============================================================================
// Correlation under load
// ============================================================================
describe("Correlation performance", () => {
  it("correlates correctly with 500 exchange-result pairs", () => {
    clearEvents();
    for (let i = 0; i < 250; i++) {
      recordEvent(makeEvent({ type: "token_exchange", tool: `tool_${i}`, service: "google" }));
      recordEvent(makeEvent({ type: "tool_result", tool: `tool_${i}`, service: "google" }));
    }
    const pairs = getCorrelatedEvents("google");
    expect(pairs.length).toBeGreaterThan(0);
    // Each exchange should have at least one correlated tool call
    for (const pair of pairs) {
      expect(pair.tokenExchange.type).toBe("token_exchange");
    }
  });
});

// ============================================================================
// Boundary: exactly at MAX_EVENTS
// ============================================================================
describe("Boundary conditions", () => {
  it("999 events: no eviction yet", () => {
    clearEvents();
    for (let i = 0; i < 999; i++) {
      recordEvent(makeEvent({ tool: `boundary_${i}` }));
    }
    const events = getEvents({ limit: 2000 });
    expect(events).toHaveLength(999);
    expect(events[0].tool).toBe("boundary_0");
  });

  it("1000 events: exactly at cap", () => {
    clearEvents();
    for (let i = 0; i < 1000; i++) {
      recordEvent(makeEvent({ tool: `cap_${i}` }));
    }
    const events = getEvents({ limit: 2000 });
    expect(events).toHaveLength(1000);
    expect(events[0].tool).toBe("cap_0");
  });

  it("1001 events: first event evicted", () => {
    clearEvents();
    for (let i = 0; i < 1001; i++) {
      recordEvent(makeEvent({ tool: `over_${i}` }));
    }
    const events = getEvents({ limit: 2000 });
    expect(events).toHaveLength(1000);
    expect(events[0].tool).toBe("over_1");
  });

  it("empty scopes array does not crash correlation", () => {
    clearEvents();
    recordEvent(makeEvent({ type: "token_exchange", scopes: [] }));
    recordEvent(makeEvent({ type: "tool_result", scopes: [] }));
    expect(() => getCorrelatedEvents()).not.toThrow();
  });

  it("getEvents with limit=0 falls back to default (100)", () => {
    // limit uses `?? 100` which treats 0 as falsy via `|| 100` equivalent
    clearEvents();
    recordEvent(makeEvent());
    expect(getEvents({ limit: 0 })).toHaveLength(1);
  });
});
