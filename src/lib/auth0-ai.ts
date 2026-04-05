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
  const token = session?.tokenSet?.refreshToken;
  if (!token) {
    throw new Error("No refresh token available — user may need to re-authenticate");
  }
  return token;
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

// ---------------------------------------------------------------------------
// Management API fallback — for providers that don't issue refresh tokens
// (e.g., GitHub OAuth Apps), Token Vault exchange fails. This helper
// retrieves the stored access_token directly from the user's identity
// via the Auth0 Management API.
// ---------------------------------------------------------------------------

let _mgmtTokenCache: { token: string; expiresAt: number } | null = null;

async function getManagementToken(): Promise<string> {
  if (_mgmtTokenCache && Date.now() < _mgmtTokenCache.expiresAt) {
    return _mgmtTokenCache.token;
  }
  const res = await fetch(`https://${process.env.AUTH0_DOMAIN ?? process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, "")}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_DOMAIN ?? process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, "")}/api/v2/`,
    }),
  });
  if (!res.ok) throw new Error("Failed to get Management API token");
  const data = await res.json();
  _mgmtTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

/**
 * Get the upstream provider's access_token from the user's linked identity.
 * If the identity has a refresh_token (e.g., Google with access_type=offline),
 * automatically refreshes expired access_tokens.
 */
export async function getIdentityToken(connection: string): Promise<string | null> {
  try {
    const { auth0 } = await import("@/lib/auth0");
    const session = await auth0.getSession();
    if (!session?.user?.sub) return null;

    const mgmtToken = await getManagementToken();
    const domain = process.env.AUTH0_DOMAIN ?? process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, "");
    const res = await fetch(
      `https://${domain}/api/v2/users/${encodeURIComponent(session.user.sub)}?fields=identities&include_fields=true`,
      { headers: { Authorization: `Bearer ${mgmtToken}` } }
    );
    if (!res.ok) return null;

    const user = await res.json();
    const identity = user.identities?.find(
      (id: { connection: string }) => id.connection === connection
    );
    // Slack fallback: use env var (Auth0 identity linking loses Slack tokens)
    if (!identity?.access_token && connection === "sign-in-with-slack") {
      return process.env.SLACK_BOT_TOKEN ?? null;
    }
    if (!identity?.access_token) return null;

    // For Google: if we have a refresh_token, use it to get a fresh access_token
    if (identity.refresh_token && connection === "google-oauth2") {
      return refreshGoogleToken(identity.refresh_token);
    }

    return identity.access_token;
  } catch {
    return null;
  }
}

/** Refresh a Google access_token using the stored refresh_token */
async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  try {
    // Use our custom Google OAuth client credentials
    const googleClientId = "REDACTED_GOOGLE_CLIENT_ID";
    const googleClientSecret = "REDACTED_GOOGLE_CLIENT_SECRET";

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: googleClientId,
        client_secret: googleClientSecret,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}
