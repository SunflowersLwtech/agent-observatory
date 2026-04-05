import type { Tool } from "ai";
import { confirmHighRiskOperation } from "@/lib/observatory/step-up";
import {
  getWithGoogleCalendar,
  getWithGitHub,
  getWithSlack,
} from "@/lib/auth0-ai";

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

    // Wrap each tool with Token Vault (RFC 8693 token exchange).
    // The wrapper checks the user's federated connection status before
    // execution. If credentials are missing, it throws a TokenVaultInterrupt
    // that withInterruptions() converts into a Connect dialog.
    // The tool's internal getIdentityTokenWithMeta() call serves as the
    // Management API fallback for providers without Token Vault refresh.
    const wrapGoogle = getWithGoogleCalendar();
    const wrapGitHub = getWithGitHub();
    const wrapSlack = getWithSlack();

    _allTools = {
      // Step-up authorization tool (Pattern 3: Interrupt-as-Circuit-Breaker)
      confirmHighRiskOperation,
      // Google Calendar tools (Token Vault: google-oauth2)
      checkCalendarAvailability: wrapGoogle(checkCalendarAvailability),
      listCalendarEvents: wrapGoogle(listCalendarEvents),
      // GitHub tools (Token Vault: github)
      listGitHubRepos: wrapGitHub(listGitHubRepos),
      listGitHubIssues: wrapGitHub(listGitHubIssues),
      // Slack tools (Token Vault: slack)
      listSlackChannels: wrapSlack(listSlackChannels),
      sendSlackMessage: wrapSlack(sendSlackMessage),
    };
  }
  return _allTools;
}
