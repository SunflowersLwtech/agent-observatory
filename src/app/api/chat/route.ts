import {
  streamText,
  convertToModelMessages,
  UIMessage,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { setAIContext } from "@auth0/ai-vercel";
import { withInterruptions, errorSerializer, InterruptionPrefix } from "@auth0/ai-vercel/interrupts";
import { Auth0Interrupt } from "@auth0/ai/interrupts";
import { getAllTools } from "@/lib/tools";
import { auth0 } from "@/lib/auth0";
import { initializeUserPermissions } from "@/lib/fga/model";
import { recordEvent } from "@/lib/observatory/event-store";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are the Agent Observatory Assistant — a security-aware AI agent that helps users interact with their connected services (Google Calendar, GitHub, and Slack) while maintaining full transparency about every action you take.

## Core Principles
1. **Transparency**: Before taking any action, explain what you're about to do, which service you'll access, and what permissions are needed.
2. **Least Privilege**: Only request the minimum scopes needed for each operation.
3. **User Control**: Always confirm before performing write operations (sending messages, creating issues).
4. **Observability**: Your actions are being logged in real-time on the Observatory Dashboard.

## Available Capabilities
- **Google Calendar**: Check availability, list upcoming events
- **GitHub**: List repositories, browse issues
- **Slack**: List channels, send messages (requires confirmation)

## Behavioral Guidelines
- When a user asks about their schedule, use the calendar tools.
- When a user asks about code or projects, use the GitHub tools.
- When a user asks about team communication, use the Slack tools.
- If a tool fails due to missing connection, guide the user to connect their account.
- Reference the Observatory Dashboard for users wanting to see their audit trail.

## MANDATORY: Step-Up Authorization for Write Operations
Before ANY write operation (sendSlackMessage), you MUST:
1. First call confirmHighRiskOperation with the operation details
2. Explain to the user exactly what you will do, which service, and why it's high risk
3. Wait for the user to explicitly say "yes", "confirm", "go ahead", or similar
4. Only THEN call the actual write tool
5. If the user does not confirm, do NOT proceed

This implements Pattern 3: Interrupt-as-Circuit-Breaker (OWASP ASI09 mitigation).

## Security Posture
You operate under OWASP Top 10 for Agentic Applications guidelines. Every tool call is:
- Risk-classified (low/medium/high/critical)
- Mapped to OWASP categories (ASI01-ASI10)
- Logged with full audit trail
- Checked against FGA authorization model
- Subject to step-up authorization for high-risk operations`;

export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, id }: { messages: UIMessage[]; id: string } =
    await req.json();

  // Initialize FGA permissions for this user (idempotent)
  const userId = session.user.sub;
  initializeUserPermissions(userId);

  recordEvent({
    type: "authorization_decision",
    tool: "session_start",
    service: "auth0",
    scopes: [],
    riskLevel: "low",
    owaspCategories: ["ASI03"],
    outcome: "success",
    details: { userId, threadId: id },
  });

  setAIContext({ threadID: id });

  const tools = await getAllTools();

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: withInterruptions(
        async ({ writer }) => {
          const result = streamText({
            model: openai("gpt-4o"),
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages),
            tools,
            stopWhen: stepCountIs(10),
          });

          writer.merge(result.toUIMessageStream({ sendReasoning: true }));

          // Wait for completion — if any tool threw an Auth0Interrupt,
          // re-throw it as a stream error so the client's useInterruptions
          // can detect it and show the ConsentDialog.
          try {
            await result.response;
          } catch (err: unknown) {
            const cause = (err as { cause?: unknown })?.cause;
            if (cause instanceof Auth0Interrupt) {
              const ser = errorSerializer();
              const msg = ser(err as Parameters<ReturnType<typeof errorSerializer>>[0]);
              throw new Error(msg);
            }
            throw err;
          }
        },
        { messages, tools }
      ),
    }),
  });
}
