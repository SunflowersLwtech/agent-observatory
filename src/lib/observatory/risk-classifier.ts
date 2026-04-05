import type { OWASPCategory, RiskLevel } from "./event-store";

// OWASP Top 10 for Agentic Applications risk mapping
export const OWASP_RISKS: Record<
  OWASPCategory,
  { name: string; description: string }
> = {
  ASI01: {
    name: "Agent Goal Hijack",
    description: "Prompt injection or goal manipulation",
  },
  ASI02: {
    name: "Tool Misuse & Exploitation",
    description: "Legitimate tools used for unintended purposes",
  },
  ASI03: {
    name: "Identity & Privilege Abuse",
    description: "Agent exceeds intended authorization scope",
  },
  ASI04: {
    name: "Agentic Supply Chain",
    description: "Compromised tool definitions or dependencies",
  },
  ASI05: {
    name: "Unexpected Code Execution",
    description: "Agent runs code outside sandbox boundaries",
  },
  ASI06: {
    name: "Memory & Context Poisoning",
    description: "Manipulation of RAG data or agent memory",
  },
  ASI07: {
    name: "Insecure Inter-Agent Comm",
    description: "Unverified communication between agents",
  },
  ASI08: {
    name: "Cascading Failures",
    description: "Error propagation across agent operations",
  },
  ASI09: {
    name: "Human-Agent Trust Exploitation",
    description: "Agent exploits user trust for elevated access",
  },
  ASI10: {
    name: "Rogue Agents",
    description: "Agent operates outside expected behavioral bounds",
  },
};

// Scope-based risk classification (Pattern 2: Scope-Bound Risk Classification)
const SCOPE_RISK_MAP: Record<string, { risk: RiskLevel; owasp: OWASPCategory[] }> = {
  // Google Calendar - read operations
  "https://www.googleapis.com/auth/calendar.freebusy": {
    risk: "low",
    owasp: ["ASI03"],
  },
  "https://www.googleapis.com/auth/calendar.events.readonly": {
    risk: "low",
    owasp: ["ASI03"],
  },
  // Google Calendar - write operations
  "https://www.googleapis.com/auth/calendar.events": {
    risk: "high",
    owasp: ["ASI02", "ASI03"],
  },
  // GitHub - read
  "read:user": { risk: "low", owasp: ["ASI03"] },
  "repo": { risk: "medium", owasp: ["ASI02", "ASI03"] },
  // GitHub - write
  "write:repo": { risk: "high", owasp: ["ASI02", "ASI03", "ASI04"] },
  // Slack - read
  "channels:read": { risk: "low", owasp: ["ASI03"] },
  "groups:read": { risk: "low", owasp: ["ASI03"] },
  "users:read": { risk: "low", owasp: ["ASI03"] },
  // Slack - write
  "chat:write": { risk: "high", owasp: ["ASI02", "ASI03", "ASI09"] },
};

// Tool-based risk classification
const TOOL_RISK_MAP: Record<string, { risk: RiskLevel; owasp: OWASPCategory[] }> = {
  // Read-only tools
  check_calendar_availability: { risk: "low", owasp: ["ASI03"] },
  list_calendar_events: { risk: "low", owasp: ["ASI03"] },
  list_github_repos: { risk: "low", owasp: ["ASI03"] },
  get_github_repo: { risk: "low", owasp: ["ASI03"] },
  list_github_issues: { risk: "low", owasp: ["ASI03"] },
  list_slack_channels: { risk: "low", owasp: ["ASI03"] },
  // Write tools
  send_slack_message: { risk: "high", owasp: ["ASI02", "ASI03", "ASI09"] },
  create_github_issue: { risk: "medium", owasp: ["ASI02", "ASI03"] },
};

export function classifyToolRisk(
  toolName: string,
  scopes: string[]
): { riskLevel: RiskLevel; owaspCategories: OWASPCategory[] } {
  const toolRisk = TOOL_RISK_MAP[toolName];
  const scopeRisks = scopes
    .map((s) => SCOPE_RISK_MAP[s])
    .filter(Boolean);

  // Aggregate risk: highest risk wins
  const allRisks = [toolRisk, ...scopeRisks].filter(Boolean);
  const riskOrder: RiskLevel[] = ["low", "medium", "high", "critical"];

  let maxRisk: RiskLevel = "low";
  const owaspSet = new Set<OWASPCategory>();

  for (const r of allRisks) {
    if (riskOrder.indexOf(r.risk) > riskOrder.indexOf(maxRisk)) {
      maxRisk = r.risk;
    }
    r.owasp.forEach((o) => owaspSet.add(o));
  }

  return {
    riskLevel: maxRisk,
    owaspCategories: Array.from(owaspSet),
  };
}

// Risk threshold for step-up authorization (Pattern 3: Interrupt-as-Circuit-Breaker)
export function shouldTriggerStepUp(riskLevel: RiskLevel): boolean {
  return riskLevel === "high" || riskLevel === "critical";
}

// ============================================================================
// RULE-BASED RUNTIME SECURITY MONITOR
// Transforms static risk taxonomy → live runtime security analysis
// Addresses RSAC 2026 gap: "nothing tracks what happens after authentication"
// ============================================================================

// Configurable thresholds (override via environment variables)
const VELOCITY_THRESHOLD = Number(process.env.ANOMALY_VELOCITY ?? 15);
const ERROR_BURST_THRESHOLD = Number(process.env.ANOMALY_ERROR_BURST ?? 3);
const CROSS_SERVICE_WINDOW_MS = Number(process.env.ANOMALY_CROSS_SERVICE_WINDOW ?? 10_000);

export interface AnomalyScore {
  score: number; // 0-100 (0 = normal, 100 = highly anomalous)
  signals: AnomalySignal[];
  recommendation: "normal" | "elevated" | "step_up_required" | "block";
}

export interface AnomalySignal {
  type: "velocity" | "cross_service" | "scope_escalation" | "error_burst";
  severity: number; // 0-100 contribution to overall score
  description: string;
  owaspCategory: OWASPCategory;
}

/**
 * Compute real-time behavioral anomaly score for the current session.
 * Analyzes the event stream for four anomaly signals:
 *
 * 1. Velocity anomaly — too many tool calls in a short window (ASI10: Rogue Agent)
 * 2. Cross-service escalation — read from A then write to B (ASI01: Goal Hijack)
 * 3. Scope escalation — higher-risk scopes than prior calls (ASI03: Privilege Abuse)
 * 4. Error burst — repeated failures indicating probing (ASI02: Tool Misuse)
 */
export function computeSessionAnomalyScore(
  events: Array<{
    timestamp: number;
    type: string;
    service: string;
    riskLevel: string;
    outcome: string;
    tool: string;
  }>,
  windowMs: number = 300_000 // default 5 minutes (aligned with getEventStats 5min window)
): AnomalyScore {
  const signals: AnomalySignal[] = [];
  const now = Date.now();
  const recent = events.filter((e) => e.timestamp >= now - windowMs);

  // Signal 1: Velocity anomaly (>15 tool calls per minute, scaled to window)
  const toolCalls = recent.filter(
    (e) => e.type === "tool_result" || e.type === "token_exchange"
  );
  const velocityThreshold = Math.ceil(VELOCITY_THRESHOLD * (windowMs / 60_000));
  if (toolCalls.length > velocityThreshold) {
    signals.push({
      type: "velocity",
      severity: Math.min(40, (toolCalls.length - velocityThreshold) * 5),
      description: `${toolCalls.length} operations in ${windowMs / 1000}s (threshold: ${velocityThreshold})`,
      owaspCategory: "ASI10",
    });
  }

  // Signal 2: Cross-service escalation (read from A → write to B within 10s)
  const riskOrder: RiskLevel[] = ["low", "medium", "high", "critical"];
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    if (
      prev.service !== curr.service &&
      riskOrder.indexOf(prev.riskLevel as RiskLevel) <= 1 && // prev was low/medium (read)
      riskOrder.indexOf(curr.riskLevel as RiskLevel) >= 2 && // curr is high/critical (write)
      curr.timestamp - prev.timestamp < CROSS_SERVICE_WINDOW_MS
    ) {
      signals.push({
        type: "cross_service",
        severity: 35,
        description: `Read ${prev.service} → Write ${curr.service} within ${Math.round((curr.timestamp - prev.timestamp) / 1000)}s`,
        owaspCategory: "ASI01",
      });
      break; // Only count once per window
    }
  }

  // Signal 3: Scope escalation (current call higher risk than session average)
  if (recent.length >= 3) {
    const avgRisk =
      recent.reduce(
        (sum, e) => sum + riskOrder.indexOf(e.riskLevel as RiskLevel),
        0
      ) / recent.length;
    const lastRisk = riskOrder.indexOf(
      recent[recent.length - 1]?.riskLevel as RiskLevel
    );
    if (lastRisk > avgRisk + 1) {
      signals.push({
        type: "scope_escalation",
        severity: 25,
        description: `Risk escalated from avg ${avgRisk.toFixed(1)} to ${lastRisk}`,
        owaspCategory: "ASI03",
      });
    }
  }

  // Signal 4: Error burst (>3 failures in window = possible probing)
  const failures = recent.filter((e) => e.outcome === "failure");
  if (failures.length > ERROR_BURST_THRESHOLD) {
    signals.push({
      type: "error_burst",
      severity: Math.min(30, failures.length * 6),
      description: `${failures.length} failures in ${windowMs / 1000}s (possible probing)`,
      owaspCategory: "ASI02",
    });
  }

  // Compute overall score
  const score = Math.min(
    100,
    signals.reduce((sum, s) => sum + s.severity, 0)
  );

  // Determine recommendation
  let recommendation: AnomalyScore["recommendation"] = "normal";
  if (score >= 70) recommendation = "block";
  else if (score >= 50) recommendation = "step_up_required";
  else if (score >= 25) recommendation = "elevated";

  return { score, signals, recommendation };
}
