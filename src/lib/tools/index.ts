import type { Tool } from "ai";
import { confirmHighRiskOperation } from "@/lib/observatory/step-up";

let _allTools: Record<string, Tool> | null = null;

export function getAllTools(): Record<string, Tool> {
  if (!_allTools) {
    // Lazy import to avoid Auth0 SDK init at build time
    const {
      checkCalendarAvailability,
      listCalendarEvents,
    } = require("./google-calendar");
    const { listGitHubRepos, listGitHubIssues } = require("./github");
    const { listSlackChannels, sendSlackMessage } = require("./slack");

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
