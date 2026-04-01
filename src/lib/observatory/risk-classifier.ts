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
