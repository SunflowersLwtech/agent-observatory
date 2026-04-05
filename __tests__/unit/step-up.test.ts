import { describe, it, expect } from "vitest";
import { confirmHighRiskOperation } from "@/lib/observatory/step-up";
import { getEvents } from "@/lib/observatory/event-store";

describe("confirmHighRiskOperation tool", () => {
  it("has correct tool metadata", () => {
    expect(confirmHighRiskOperation.description).toContain("HIGH RISK");
    expect(confirmHighRiskOperation.description).toContain("confirmation");
  });

  it("execute returns confirmed: false (always blocks)", async () => {
    const result = await confirmHighRiskOperation.execute!(
      {
        operation: "Send a message in #general",
        service: "slack",
        riskReason: "ASI09: Human-Agent Trust Exploitation",
      },
      // The tool execute function expects a second argument (toolExecutionOptions)
      // but the implementation only uses the first. Pass an empty-ish object.
      undefined as never
    ) as { confirmed: boolean; requiresUserApproval: boolean; instruction: string; operation: string; service: string; riskLevel: string; owaspCategories: string[] };
    expect(result.confirmed).toBe(false);
    expect(result.requiresUserApproval).toBe(true);
    expect(result.riskLevel).toBe("high");
  });

  it("records a step_up_triggered event", async () => {
    await confirmHighRiskOperation.execute!(
      {
        operation: "Delete repo",
        service: "github",
        riskReason: "ASI02: Tool Misuse",
      },
      undefined as never
    ) as { confirmed: boolean; requiresUserApproval: boolean; instruction: string; operation: string; service: string; riskLevel: string; owaspCategories: string[] };
    const events = getEvents({ type: "step_up_triggered" });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const last = events[events.length - 1];
    expect(last.service).toBe("github");
    expect(last.owaspCategories).toContain("ASI09");
  });

  it("includes instruction telling agent to STOP", async () => {
    const result = await confirmHighRiskOperation.execute!(
      {
        operation: "Send email",
        service: "google",
        riskReason: "Write operation",
      },
      undefined as never
    ) as { confirmed: boolean; requiresUserApproval: boolean; instruction: string; operation: string; service: string; riskLevel: string; owaspCategories: string[] };
    expect(result.instruction).toContain("STOP");
    expect(result.instruction).toContain("Send email");
  });
});
