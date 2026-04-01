import {
  checkCalendarAvailability,
  listCalendarEvents,
} from "./google-calendar";
import { listGitHubRepos, listGitHubIssues } from "./github";
import { listSlackChannels, sendSlackMessage } from "./slack";

export const allTools = {
  checkCalendarAvailability,
  listCalendarEvents,
  listGitHubRepos,
  listGitHubIssues,
  listSlackChannels,
  sendSlackMessage,
};
