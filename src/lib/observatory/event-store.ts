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

// In-memory event store (per-process, sufficient for hackathon demo)
const events: ObservatoryEvent[] = [];
const tokenStates: Map<string, TokenState> = new Map();
const MAX_EVENTS = 1000;

let eventCounter = 0;

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
  return full;
}

export function getEvents(opts?: {
  limit?: number;
  since?: number;
  type?: EventType;
  service?: string;
  riskLevel?: RiskLevel;
}): ObservatoryEvent[] {
  let filtered = events;
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

export function getEventStats() {
  const last5min = Date.now() - 5 * 60 * 1000;
  const recent = events.filter((e) => e.timestamp >= last5min);
  return {
    total: events.length,
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
  state: Partial<TokenState> & { service: string; connection: string }
): void {
  const existing = tokenStates.get(key);
  tokenStates.set(key, {
    scopes: [],
    status: "disconnected",
    healthScore: 0,
    ...existing,
    ...state,
  });
}

export function getTokenStates(): TokenState[] {
  return Array.from(tokenStates.values());
}

export function clearEvents(): void {
  events.length = 0;
}
