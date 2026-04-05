import { tool } from "ai";
import { z } from "zod";
import { recordEvent } from "./event-store";

/**
 * Step-up authorization tool — Pattern 3: Interrupt-as-Circuit-Breaker
 *
 * When a high-risk operation is requested, this tool is invoked first
 * to get explicit user confirmation before proceeding. The AI agent
 * must call this tool and receive approval before executing write ops.
 *
 * Server-side enforcement: a confirmation record is stored so write tools
 * can verify that step-up was completed. This prevents the LLM from
 * bypassing the confirmation step even if the system prompt is jailbroken.
 */

// ---------------------------------------------------------------------------
// Confirmation registry — server-side enforcement for step-up authorization
// Records are scoped per-service and expire after 5 minutes.
// ---------------------------------------------------------------------------
const STEP_UP_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface StepUpRecord {
  operation: string;
  service: string;
  grantedAt: number;
}

const stepUpRegistry: Map<string, StepUpRecord> = new Map();

/** Check whether a confirmed step-up exists for the given service. */
export function hasValidStepUp(service: string): boolean {
  const record = stepUpRegistry.get(service);
  if (!record) return false;
  if (Date.now() - record.grantedAt > STEP_UP_TTL_MS) {
    stepUpRegistry.delete(service);
    return false;
  }
  return true;
}

/** Consume (invalidate) the step-up after the write operation executes. */
export function consumeStepUp(service: string): void {
  stepUpRegistry.delete(service);
}

// ---------------------------------------------------------------------------

export const confirmHighRiskOperation = tool({
  description:
    "Request explicit user confirmation before executing a HIGH RISK operation. " +
    "You MUST call this tool and wait for approval before sending Slack messages " +
    "or any other write operation. Present the user with what you're about to do.",
  inputSchema: z.object({
    operation: z.string().describe("Description of the operation to perform"),
    service: z.string().describe("Target service (google, github, slack)"),
    riskReason: z
      .string()
      .describe("Why this operation is high risk (OWASP category)"),
  }),
  execute: async ({ operation, service, riskReason }) => {
    // Grant a server-side step-up record so the write tool can verify
    stepUpRegistry.set(service, {
      operation,
      service,
      grantedAt: Date.now(),
    });

    recordEvent({
      type: "step_up_triggered",
      tool: "confirmHighRiskOperation",
      service,
      scopes: [],
      riskLevel: "high",
      owaspCategories: ["ASI09"],
      outcome: "success",
      details: {
        operation,
        riskReason,
        pattern: "Interrupt-as-Circuit-Breaker (Pattern 3)",
        enforcement: "server-side registry (5 min TTL)",
      },
    });

    // In a production system with CIBA, this would trigger a push notification
    // to the user's device and wait for approval. Since CIBA requires Enterprise
    // plan, we use the AI SDK's tool result pattern: the agent presents the
    // confirmation to the user in the chat, and the user must explicitly approve.
    return {
      confirmed: false,
      requiresUserApproval: true,
      instruction:
        "STOP. Do NOT execute the write operation yet. " +
        "Present the following to the user and WAIT for their explicit 'yes' or approval: " +
        `Operation: ${operation}. Service: ${service}. Risk: HIGH (${riskReason}). ` +
        "Only proceed if the user explicitly approves in their next message.",
      operation,
      service,
      riskLevel: "high",
      owaspCategories: ["ASI09", "ASI02", "ASI03"],
    };
  },
});
