import { Redis } from "@upstash/redis";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type EventType =
  | "token_exchange"
  | "tool_call"
  | "tool_result"
  | "authorization_decision"
  | "step_up_triggered"
  | "error"
  | "connection_status";

export type OWASPCategory =
  | "ASI01"
  | "ASI02"
  | "ASI03"
  | "ASI04"
  | "ASI05"
  | "ASI06"
  | "ASI07"
  | "ASI08"
  | "ASI09"
  | "ASI10";

export interface ObservatoryEvent {
  id: string;
  timestamp: number;
  type: EventType;
  tool: string;
  service: string;
  scopes: string[];
  riskLevel: RiskLevel;
  owaspCategories: OWASPCategory[];
  outcome: "success" | "failure" | "pending" | "interrupted";
  details: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  duration?: number;
}

export interface TokenState {
  service: string;
  connection: string;
  status: "connected" | "disconnected" | "expired" | "refreshing" | "error";
  lastExchanged?: number;
  lastRefreshed?: number;
  expiresAt?: number;
  scopes: string[];
  errorMessage?: string;
  healthScore: number; // 0-100
}

// ---------------------------------------------------------------------------
// Redis client — persistent storage across deployments (Upstash via Vercel Marketplace)
// Falls back to in-memory when UPSTASH_REDIS_REST_URL / KV_REST_API_URL is not set.
// ---------------------------------------------------------------------------
const redis =
  process.env.KV_REST_API_URL
    ? new Redis({ url: process.env.KV_REST_API_URL.trim(), token: process.env.KV_REST_API_TOKEN!.trim() })
    : process.env.UPSTASH_REDIS_REST_URL
      ? Redis.fromEnv()
      : null;

const REDIS_EVENTS_KEY = "observatory:events";
const REDIS_TOKENS_KEY = "observatory:tokens";

// In-memory cache (serves reads; Redis provides cross-deploy persistence)
const events: ObservatoryEvent[] = [];
const tokenStates: Map<string, TokenState> = new Map();
const MAX_EVENTS = 1000;

let eventCounter = 0;
let _hydrated = false;

/**
 * Hydrate in-memory store from Redis on cold start.
 * Call once at the top of every route handler that reads events.
 * No-op when Redis is unconfigured or already hydrated.
 */
export async function ensureHydrated(): Promise<void> {
  if (_hydrated || !redis) return;
  try {
    const stored = await redis.lrange<ObservatoryEvent>(REDIS_EVENTS_KEY, 0, -1);
    if (stored.length > 0 && events.length === 0) {
      events.push(...stored);
    }
    const tokens = await redis.hgetall<Record<string, TokenState>>(REDIS_TOKENS_KEY);
    if (tokens && tokenStates.size === 0) {
      for (const [key, state] of Object.entries(tokens)) {
        tokenStates.set(key, state);
      }
    }
  } catch (e) {
    console.error("[event-store] Redis hydration failed, using memory-only:", e);
  }
  _hydrated = true;
}

export function generateEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

export function recordEvent(
  event: Omit<ObservatoryEvent, "id" | "timestamp">
): ObservatoryEvent {
  const full: ObservatoryEvent = {
    ...event,
    id: generateEventId(),
    timestamp: Date.now(),
  };
  events.push(full);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  // Persist to Redis (fire-and-forget)
  if (redis) {
    redis
      .rpush(REDIS_EVENTS_KEY, full)
      .then(() => redis.ltrim(REDIS_EVENTS_KEY, -MAX_EVENTS, -1))
      .catch(console.error);
  }
  return full;
}

export function getEvents(opts?: {
  limit?: number;
  since?: number;
  type?: EventType;
  service?: string;
  riskLevel?: RiskLevel;
  userId?: string;
}): ObservatoryEvent[] {
  let filtered = events;
  if (opts?.userId) {
    filtered = filtered.filter((e) => e.userId === opts.userId);
  }
  if (opts?.since) {
    filtered = filtered.filter((e) => e.timestamp >= opts.since!);
  }
  if (opts?.type) {
    filtered = filtered.filter((e) => e.type === opts.type);
  }
  if (opts?.service) {
    filtered = filtered.filter((e) => e.service === opts.service);
  }
  if (opts?.riskLevel) {
    filtered = filtered.filter((e) => e.riskLevel === opts.riskLevel);
  }
  const limit = opts?.limit ?? 100;
  return filtered.slice(-limit);
}

export function getEventStats(userId?: string) {
  const scoped = userId ? events.filter((e) => e.userId === userId) : events;
  const last5min = Date.now() - 5 * 60 * 1000;
  const recent = scoped.filter((e) => e.timestamp >= last5min);
  return {
    total: scoped.length,
    recent: recent.length,
    byRisk: {
      low: recent.filter((e) => e.riskLevel === "low").length,
      medium: recent.filter((e) => e.riskLevel === "medium").length,
      high: recent.filter((e) => e.riskLevel === "high").length,
      critical: recent.filter((e) => e.riskLevel === "critical").length,
    },
    byService: {
      google: recent.filter((e) => e.service === "google").length,
      github: recent.filter((e) => e.service === "github").length,
      slack: recent.filter((e) => e.service === "slack").length,
    },
    byOutcome: {
      success: recent.filter((e) => e.outcome === "success").length,
      failure: recent.filter((e) => e.outcome === "failure").length,
      interrupted: recent.filter((e) => e.outcome === "interrupted").length,
    },
  };
}

export function updateTokenState(
  key: string,
  state: Partial<TokenState> & { service: string; connection: string },
  userId?: string
): void {
  const storeKey = userId ? `${userId}:${key}` : key;
  const existing = tokenStates.get(storeKey);
  const merged: TokenState = {
    scopes: [],
    status: "disconnected",
    healthScore: 0,
    ...existing,
    ...state,
  };
  tokenStates.set(storeKey, merged);
  // Persist to Redis (fire-and-forget)
  if (redis) {
    redis.hset(REDIS_TOKENS_KEY, { [storeKey]: merged }).catch(console.error);
  }
}

export function getTokenStates(userId?: string): TokenState[] {
  if (userId) {
    const prefix = `${userId}:`;
    return Array.from(tokenStates.entries())
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => v);
  }
  return Array.from(tokenStates.values());
}

export function clearEvents(): void {
  events.length = 0;
  _hydrated = false;
  if (redis) {
    redis.del(REDIS_EVENTS_KEY).catch(console.error);
  }
}

// ============================================================================
// CREDENTIAL-EVENT CORRELATION (Pattern 1)
// Answers: "Which tool calls consumed credentials from Service X?"
// ============================================================================

export interface CorrelatedPair {
  tokenExchange: ObservatoryEvent;
  toolCalls: ObservatoryEvent[];
}

export function getCorrelatedEvents(
  service?: string,
  since?: number,
  userId?: string
): CorrelatedPair[] {
  let filtered = events;
  if (userId) {
    filtered = filtered.filter((e) => e.userId === userId);
  }
  if (service) {
    filtered = filtered.filter((e) => e.service === service);
  }
  if (since) {
    filtered = filtered.filter((e) => e.timestamp >= since);
  }

  const exchanges = filtered.filter((e) => e.type === "token_exchange");
  const results = filtered.filter((e) => e.type === "tool_result");

  return exchanges.map((exchange) => ({
    tokenExchange: exchange,
    toolCalls: results.filter(
      (r) => r.tool === exchange.tool && r.service === exchange.service &&
        r.timestamp >= exchange.timestamp &&
        r.timestamp - exchange.timestamp < 30_000 // within 30s window
    ),
  }));
}
