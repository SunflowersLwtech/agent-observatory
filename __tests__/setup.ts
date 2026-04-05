/**
 * Vitest global setup.
 *
 * - Resets shared in-memory stores between tests so they don't leak state.
 * - Stubs environment variables with safe defaults so tests can run without
 *   a real Auth0 tenant (the "read-only" / offline-first guarantee).
 */
import { beforeEach } from "vitest";
import { clearEvents } from "@/lib/observatory/event-store";

// Default env stubs — tests run without real credentials
process.env.AUTH0_SECRET ??= "test-secret-for-vitest";
process.env.AUTH0_BASE_URL ??= "http://localhost:3000";
process.env.AUTH0_ISSUER_BASE_URL ??= "https://test-tenant.auth0.com";
process.env.AUTH0_CLIENT_ID ??= "test-client-id";
process.env.AUTH0_CLIENT_SECRET ??= "test-client-secret";
process.env.OPENAI_API_KEY ??= "sk-test-key";

beforeEach(() => {
  clearEvents();
});
