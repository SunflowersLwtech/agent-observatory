import { Auth0AI } from "@auth0/ai-vercel";
import type { ToolWrapper } from "@auth0/ai-vercel";

let _auth0AI: Auth0AI | null = null;
let _withGoogleCalendar: ToolWrapper | null = null;
let _withGitHub: ToolWrapper | null = null;
let _withSlack: ToolWrapper | null = null;

function getAuth0AI() {
  if (!_auth0AI) {
    _auth0AI = new Auth0AI();
  }
  return _auth0AI;
}

async function getRefreshToken() {
  const { auth0 } = await import("@/lib/auth0");
  const session = await auth0.getSession();
  return session?.tokenSet.refreshToken as string;
}

export function getWithGoogleCalendar(): ToolWrapper {
  if (!_withGoogleCalendar) {
    _withGoogleCalendar = getAuth0AI().withTokenVault({
      connection: "google-oauth2",
      scopes: [
        "https://www.googleapis.com/auth/calendar.freebusy",
        "https://www.googleapis.com/auth/calendar.events.readonly",
      ],
      refreshToken: getRefreshToken,
    });
  }
  return _withGoogleCalendar;
}

export function getWithGitHub(): ToolWrapper {
  if (!_withGitHub) {
    _withGitHub = getAuth0AI().withTokenVault({
      connection: "github",
      scopes: ["repo", "read:user"],
      refreshToken: getRefreshToken,
    });
  }
  return _withGitHub;
}

export function getWithSlack(): ToolWrapper {
  if (!_withSlack) {
    _withSlack = getAuth0AI().withTokenVault({
      connection: "slack",
      scopes: ["channels:read", "groups:read", "chat:write", "users:read"],
      refreshToken: getRefreshToken,
    });
  }
  return _withSlack;
}
