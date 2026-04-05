import { tool } from "ai";
import { z } from "zod";
import { WebClient } from "@slack/web-api";
import { getIdentityToken } from "@/lib/auth0-ai";
import { recordEvent, updateTokenState } from "@/lib/observatory/event-store";
import { classifyToolRisk, shouldTriggerStepUp } from "@/lib/observatory/risk-classifier";
import { canAccessService, isScopeDenied } from "@/lib/fga/model";

const READ_SCOPES = ["channels:read", "groups:read", "users:read"];
const WRITE_SCOPES = ["chat:write"];

export const listSlackChannels = tool({
    description:
      "List Slack channels the user has access to, including public and private channels",
    inputSchema: z.object({
      limit: z.number().optional().default(20).describe("Max channels to return"),
    }),
    execute: async ({ limit }) => {
      // FGA authorization check
      const auth0Module = await import("@/lib/auth0");
      const session = await auth0Module.auth0.getSession();
      if (session?.user?.sub && !canAccessService(session.user.sub, "slack")) {
        return { error: "Access denied: you do not have permission to access Slack." };
      }

      if (session?.user?.sub) {
        const deniedScope = READ_SCOPES.find(s => isScopeDenied(session.user.sub, "slack", s));
        if (deniedScope) {
          return { error: `Access denied: scope "${deniedScope}" has been disabled for Slack.` };
        }
      }

      const startTime = Date.now();
      const { riskLevel, owaspCategories } = classifyToolRisk(
        "list_slack_channels",
        READ_SCOPES
      );

      recordEvent({
        type: "token_exchange",
        tool: "list_slack_channels",
        service: "slack",
        scopes: READ_SCOPES,
        riskLevel,
        owaspCategories,
        outcome: "pending",
        details: { limit },
      });

      try {
        const accessToken = await getIdentityToken("sign-in-with-slack");
        if (!accessToken) throw new Error("Slack not connected. Please connect your Slack account.");
        updateTokenState("slack", {
          service: "Slack",
          connection: "slack",
          status: "connected",
          lastExchanged: Date.now(),
          scopes: [...READ_SCOPES, ...WRITE_SCOPES],
          healthScore: 100,
        });

        const client = new WebClient(accessToken);
        const result = await client.conversations.list({
          limit,
          types: "public_channel,private_channel",
        });

        const channels = (result.channels ?? []).map((ch) => ({
          id: ch.id,
          name: ch.name,
          topic: ch.topic?.value,
          purpose: ch.purpose?.value,
          memberCount: ch.num_members,
          isPrivate: ch.is_private,
        }));

        recordEvent({
          type: "tool_result",
          tool: "list_slack_channels",
          service: "slack",
          scopes: READ_SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "success",
          duration: Date.now() - startTime,
          details: { channelCount: channels.length },
        });

        return { channels, count: channels.length };
      } catch (error: unknown) {
        const err = error as { data?: { error?: string }; message?: string };
        updateTokenState("slack", {
          service: "Slack",
          connection: "slack",
          status: "error",
          errorMessage: err.data?.error ?? err.message,
          healthScore: 0,
        });

        recordEvent({
          type: "error",
          tool: "list_slack_channels",
          service: "slack",
          scopes: READ_SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "failure",
          duration: Date.now() - startTime,
          details: { error: err.data?.error ?? err.message },
        });

        if (err.data?.error === "invalid_auth" || err.data?.error === "token_revoked") {
          const { TokenVaultError } = await import("@auth0/ai/interrupts");
          throw new TokenVaultError("Authorization required to access Slack");
        }
        throw error;
      }
    },
});

export const sendSlackMessage = tool({
    description:
      "Send a message to a Slack channel. This is a HIGH RISK operation that may require step-up authorization.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID to send message to"),
      text: z.string().describe("Message text to send"),
    }),
    execute: async ({ channel, text }) => {
      const startTime = Date.now();
      const { riskLevel, owaspCategories } = classifyToolRisk(
        "send_slack_message",
        WRITE_SCOPES
      );

      // FGA authorization check (OWASP ASI06 mitigation)
      // In production, userId comes from the auth context
      // For demo, we verify the service-level permission exists
      const auth0Module = await import("@/lib/auth0");
      const session = await auth0Module.auth0.getSession();
      if (session?.user?.sub && !canAccessService(session.user.sub, "slack")) {
        recordEvent({
          type: "authorization_decision",
          tool: "send_slack_message",
          service: "slack",
          scopes: WRITE_SCOPES,
          riskLevel: "critical",
          owaspCategories: ["ASI03", "ASI06"],
          outcome: "failure",
          details: { reason: "FGA: user lacks service access" },
        });
        return { error: "Access denied: you do not have permission to use Slack." };
      }

      if (session?.user?.sub) {
        const deniedScope = WRITE_SCOPES.find(s => isScopeDenied(session.user.sub, "slack", s));
        if (deniedScope) {
          return { error: `Access denied: scope "${deniedScope}" has been disabled for Slack.` };
        }
      }

      // Step-up check (Pattern 3: Interrupt-as-Circuit-Breaker)
      if (shouldTriggerStepUp(riskLevel)) {
        recordEvent({
          type: "step_up_triggered",
          tool: "send_slack_message",
          service: "slack",
          scopes: WRITE_SCOPES,
          riskLevel,
          owaspCategories: [...owaspCategories, "ASI09"],
          outcome: "interrupted",
          details: { channel, textLength: text.length },
        });
        return {
          error: "Step-up authorization required. Please call confirmHighRiskOperation first to approve this write operation.",
          requiresConfirmation: true,
          riskLevel,
        };
      }

      recordEvent({
        type: "authorization_decision",
        tool: "send_slack_message",
        service: "slack",
        scopes: WRITE_SCOPES,
        riskLevel,
        owaspCategories,
        outcome: "pending",
        details: {
          channel,
          textLength: text.length,
          riskNote: "Write operation - elevated risk per OWASP ASI02/ASI03",
        },
      });

      try {
        const accessToken = await getIdentityToken("sign-in-with-slack");
        if (!accessToken) throw new Error("Slack not connected. Please connect your Slack account.");
        const client = new WebClient(accessToken);
        const result = await client.chat.postMessage({ channel, text });

        recordEvent({
          type: "tool_result",
          tool: "send_slack_message",
          service: "slack",
          scopes: WRITE_SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "success",
          duration: Date.now() - startTime,
          details: {
            channel,
            messageTs: result.ts,
            textLength: text.length,
          },
        });

        return {
          success: true,
          messageId: result.ts,
          channel,
        };
      } catch (error: unknown) {
        const err = error as { data?: { error?: string }; message?: string };
        recordEvent({
          type: "error",
          tool: "send_slack_message",
          service: "slack",
          scopes: WRITE_SCOPES,
          riskLevel,
          owaspCategories,
          outcome: "failure",
          duration: Date.now() - startTime,
          details: { error: err.data?.error ?? err.message },
        });

        if (err.data?.error === "invalid_auth" || err.data?.error === "token_revoked") {
          const { TokenVaultError } = await import("@auth0/ai/interrupts");
          throw new TokenVaultError("Authorization required to access Slack");
        }
        throw error;
      }
    },
});
