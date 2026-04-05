/**
 * Integration tests for Observatory API routes.
 *
 * These tests call the route handler functions directly, mocking only
 * the Auth0 session layer.  They validate:
 *   - 401 when unauthenticated
 *   - correct JSON shapes for each view / endpoint
 *   - event recording side-effects
 *
 * No real Auth0 tenant or network required — runs offline.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordEvent, getEvents } from "@/lib/observatory/event-store";

// ── Auth0 session mock ──────────────────────────────────────────────────────
const mockSession = {
  user: { sub: "auth0|integration-test-user", name: "Test User" },
};

vi.mock("@/lib/auth0", () => ({
  auth0: {
    getSession: vi.fn().mockResolvedValue(null), // default: unauthenticated
  },
}));

// Dynamic import so the mock is in place before module evaluation
import { auth0 } from "@/lib/auth0";
const getSessionMock = vi.mocked(auth0.getSession);

function asAuthenticated() {
  getSessionMock.mockResolvedValue(mockSession as never);
}
function asUnauthenticated() {
  getSessionMock.mockResolvedValue(null);
}

// ── Helper to build NextRequest-like objects ────────────────────────────────
function makeReq(url: string, init?: RequestInit) {
  return new Request(url, init) as never;
}

// ============================================================================
// GET /api/observatory/events
// ============================================================================
describe("GET /api/observatory/events", () => {
  let handler: typeof import("@/app/api/observatory/events/route").GET;

  beforeEach(async () => {
    const mod = await import("@/app/api/observatory/events/route");
    handler = mod.GET;
  });

  it("returns 401 when unauthenticated", async () => {
    asUnauthenticated();
    const res = await handler(makeReq("http://localhost:3000/api/observatory/events"));
    expect(res.status).toBe(401);
  });

  it("returns events array when authenticated", async () => {
    asAuthenticated();
    recordEvent({
      type: "tool_result", tool: "test", service: "google",
      scopes: [], riskLevel: "low", owaspCategories: ["ASI03"],
      outcome: "success", details: {},
      userId: "auth0|integration-test-user",
    });
    const res = await handler(makeReq("http://localhost:3000/api/observatory/events"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBeGreaterThan(0);
  });

  it("view=stats returns stats + tokenStates + anomaly", async () => {
    asAuthenticated();
    const res = await handler(
      makeReq("http://localhost:3000/api/observatory/events?view=stats")
    );
    const body = await res.json();
    expect(body.stats).toBeDefined();
    expect(body.stats.byRisk).toBeDefined();
    expect(body.tokenStates).toBeDefined();
    expect(body.anomaly).toBeDefined();
    expect(typeof body.anomaly.score).toBe("number");
  });

  it("view=correlation returns correlations array", async () => {
    asAuthenticated();
    const res = await handler(
      makeReq("http://localhost:3000/api/observatory/events?view=correlation")
    );
    const body = await res.json();
    expect(Array.isArray(body.correlations)).toBe(true);
  });

  it("filters by service query param", async () => {
    asAuthenticated();
    recordEvent({
      type: "tool_result", tool: "t1", service: "google",
      scopes: [], riskLevel: "low", owaspCategories: ["ASI03"],
      outcome: "success", details: {},
      userId: "auth0|integration-test-user",
    });
    recordEvent({
      type: "tool_result", tool: "t2", service: "github",
      scopes: [], riskLevel: "low", owaspCategories: ["ASI03"],
      outcome: "success", details: {},
      userId: "auth0|integration-test-user",
    });
    const res = await handler(
      makeReq("http://localhost:3000/api/observatory/events?service=google")
    );
    const body = await res.json();
    expect(body.events.every((e: { service: string }) => e.service === "google")).toBe(true);
  });
});

// ============================================================================
// POST /api/observatory/revoke
// ============================================================================
describe("POST /api/observatory/revoke", () => {
  let handler: typeof import("@/app/api/observatory/revoke/route").POST;

  beforeEach(async () => {
    const mod = await import("@/app/api/observatory/revoke/route");
    handler = mod.POST;
  });

  it("returns 401 when unauthenticated", async () => {
    asUnauthenticated();
    const res = await handler(
      makeReq("http://localhost:3000/api/observatory/revoke", {
        method: "POST",
        body: JSON.stringify({ connection: "google-oauth2", service: "google" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("records revocation event and returns success", async () => {
    asAuthenticated();
    const res = await handler(
      makeReq("http://localhost:3000/api/observatory/revoke", {
        method: "POST",
        body: JSON.stringify({ connection: "google-oauth2", service: "google" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("google");

    // Verify event was recorded
    const events = getEvents({ type: "authorization_decision" });
    expect(events.some((e) => e.details.action === "revoke")).toBe(true);
  });

  it("managementApiRevoked is false without MGMT token", async () => {
    asAuthenticated();
    const res = await handler(
      makeReq("http://localhost:3000/api/observatory/revoke", {
        method: "POST",
        body: JSON.stringify({ connection: "github", service: "github" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const body = await res.json();
    expect(body.managementApiRevoked).toBe(false);
  });
});

// ============================================================================
// GET/POST /api/observatory/scope-toggle
// ============================================================================
describe("/api/observatory/scope-toggle", () => {
  let getHandler: typeof import("@/app/api/observatory/scope-toggle/route").GET;
  let postHandler: typeof import("@/app/api/observatory/scope-toggle/route").POST;

  beforeEach(async () => {
    const mod = await import("@/app/api/observatory/scope-toggle/route");
    getHandler = mod.GET;
    postHandler = mod.POST;
  });

  it("GET returns deniedScopes object", async () => {
    asAuthenticated();
    const res = await getHandler();
    const body = await res.json();
    expect(body.deniedScopes).toBeDefined();
  });

  it("POST deny scope → GET reflects it", async () => {
    asAuthenticated();
    // Deny a scope
    await postHandler(
      makeReq("http://localhost:3000/api/observatory/scope-toggle", {
        method: "POST",
        body: JSON.stringify({ service: "slack", scope: "chat:write", enabled: false }),
        headers: { "Content-Type": "application/json" },
      })
    );
    // Check
    const res = await getHandler();
    const body = await res.json();
    expect(body.deniedScopes.slack).toContain("chat:write");
  });

  it("POST records authorization_decision event", async () => {
    asAuthenticated();
    await postHandler(
      makeReq("http://localhost:3000/api/observatory/scope-toggle", {
        method: "POST",
        body: JSON.stringify({ service: "github", scope: "repo", enabled: true }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const events = getEvents({ type: "authorization_decision" });
    expect(events.some((e) => e.details.scope === "repo")).toBe(true);
  });
});

// ============================================================================
// GET /api/observatory/report
// ============================================================================
describe("GET /api/observatory/report", () => {
  let handler: typeof import("@/app/api/observatory/report/route").GET;

  beforeEach(async () => {
    const mod = await import("@/app/api/observatory/report/route");
    handler = mod.GET;
  });

  it("returns 401 when unauthenticated", async () => {
    asUnauthenticated();
    const res = await handler();
    expect(res.status).toBe(401);
  });

  it("returns report JSON with Content-Disposition header", async () => {
    asAuthenticated();
    const res = await handler();
    expect(res.status).toBe(200);
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("observatory-report");

    const body = await res.json();
    expect(body.metadata).toBeDefined();
    expect(body.owaspCoverage).toBeDefined();
  });
});
