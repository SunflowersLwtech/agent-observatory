import type { Tool } from "ai";
import { confirmHighRiskOperation } from "@/lib/observatory/step-up";

let _allTools: Record<string, Tool> | null = null;

export async function getAllTools(): Promise<Record<string, Tool>> {
  if (!_allTools) {
    const [
      { checkCalendarAvailability, listCalendarEvents },
      { listGitHubRepos, listGitHubIssues },
      { listSlackChannels, sendSlackMessage },
    ] = await Promise.all([
      import("./google-calendar"),
      import("./github"),
      import("./slack"),
    ]);

    _allTools = {
      // Step-up authorization tool (Pattern 3: Interrupt-as-Circuit-Breaker)
      confirmHighRiskOperation,
      // Google Calendar tools
      checkCalendarAvailability,
      listCalendarEvents,
      // GitHub tools
      listGitHubRepos,
      listGitHubIssues,
      // Slack tools
      listSlackChannels,
      sendSlackMessage,
    };
  }
  return _allTools;
}
