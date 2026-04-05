/**
 * Integration tests for the /auth/connect route.
 *
 * Tests connection allowlisting, returnTo validation,
 * and redirect behavior.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth0", () => ({
  auth0: {
    getSession: vi.fn().mockResolvedValue({
      user: { sub: "auth0|connect-test" },
    }),
  },
}));

import { auth0 } from "@/lib/auth0";

describe("GET /auth/connect", () => {
  let handler: typeof import("@/app/auth/connect/route").GET;

  beforeEach(async () => {
    const mod = await import("@/app/auth/connect/route");
    handler = mod.GET;
  });

  it("rejects missing connection parameter", async () => {
    const req = new Request("http://localhost:3000/auth/connect") as never;
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("rejects disallowed connection names", async () => {
    const req = new Request(
      "http://localhost:3000/auth/connect?connection=evil-provider"
    ) as never;
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("rejects invalid returnTo (open redirect prevention)", async () => {
    const req = new Request(
      "http://localhost:3000/auth/connect?connection=google-oauth2&returnTo=https://evil.com"
    ) as never;
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("accepts google-oauth2 connection", async () => {
    const req = new Request(
      "http://localhost:3000/auth/connect?connection=google-oauth2"
    ) as never;
    const res = await handler(req);
    // Should redirect (307 or 308)
    expect([301, 302, 303, 307, 308]).toContain(res.status);
    const location = res.headers.get("Location");
    expect(location).toContain("authorize");
    expect(location).toContain("google-oauth2");
  });

  it("accepts github connection", async () => {
    const req = new Request(
      "http://localhost:3000/auth/connect?connection=github"
    ) as never;
    const res = await handler(req);
    expect([301, 302, 303, 307, 308]).toContain(res.status);
  });

  it("accepts slack connection", async () => {
    const req = new Request(
      "http://localhost:3000/auth/connect?connection=slack"
    ) as never;
    const res = await handler(req);
    expect([301, 302, 303, 307, 308]).toContain(res.status);
  });

  it("defaults returnTo to /close", async () => {
    const req = new Request(
      "http://localhost:3000/auth/connect?connection=google-oauth2"
    ) as never;
    const res = await handler(req);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("close");
  });

  it("accepts returnTo=/dashboard", async () => {
    const req = new Request(
      "http://localhost:3000/auth/connect?connection=github&returnTo=/dashboard"
    ) as never;
    const res = await handler(req);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("dashboard");
  });

  it("redirects to login when session is missing", async () => {
    vi.mocked(auth0.getSession).mockResolvedValueOnce(null);
    const req = new Request(
      "http://localhost:3000/auth/connect?connection=google-oauth2"
    ) as never;
    const res = await handler(req);
    expect([301, 302, 303, 307, 308]).toContain(res.status);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("login");
  });
});
