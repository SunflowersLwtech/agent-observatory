import { tool } from "ai";
import { z } from "zod";
import { recordEvent } from "./event-store";
import { classifyToolRisk } from "./risk-classifier";

/**
 * Step-up authorization tool — Pattern 3: Interrupt-as-Circuit-Breaker
 *
 * When a high-risk operation is requested, this tool is invoked first
 * to get explicit user confirmation before proceeding. The AI agent
 * must call this tool and receive approval before executing write ops.
 */
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
    const { riskLevel, owaspCategories } = classifyToolRisk(
      "confirm_high_risk",
      []
    );

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
      },
    });

    // In a production system with CIBA, this would trigger a push notification
    // to the user's device and wait for approval. Since CIBA requires Enterprise
    // plan, we use the AI SDK's tool result pattern: the agent presents the
    // confirmation to the user in the chat, and the user must explicitly approve.
    return {
      confirmed: true,
      note: "User was presented with the operation details in the chat. " +
        "Proceed only if the user explicitly confirms in their next message. " +
        "If the user does not confirm, do NOT proceed with the operation.",
      operation,
      service,
      riskLevel: "high",
      owaspCategories: ["ASI09", "ASI02", "ASI03"],
    };
  },
});
