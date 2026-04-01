import type { Tool } from "ai";

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
      checkCalendarAvailability,
      listCalendarEvents,
      listGitHubRepos,
      listGitHubIssues,
      listSlackChannels,
      sendSlackMessage,
    };
  }
  return _allTools;
}
