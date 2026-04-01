import { Auth0AI } from "@auth0/ai-vercel";

const auth0AI = new Auth0AI();

export const withGoogleCalendar = auth0AI.withTokenVault({
  connection: "google-oauth2",
  scopes: [
    "https://www.googleapis.com/auth/calendar.freebusy",
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ],
  refreshToken: async () => {
    const { auth0 } = await import("@/lib/auth0");
    const session = await auth0.getSession();
    return session?.tokenSet.refreshToken as string;
  },
});

export const withGitHub = auth0AI.withTokenVault({
  connection: "github",
  scopes: ["repo", "read:user"],
  refreshToken: async () => {
    const { auth0 } = await import("@/lib/auth0");
    const session = await auth0.getSession();
    return session?.tokenSet.refreshToken as string;
  },
});

export const withSlack = auth0AI.withTokenVault({
  connection: "slack",
  scopes: ["channels:read", "groups:read", "chat:write", "users:read"],
  refreshToken: async () => {
    const { auth0 } = await import("@/lib/auth0");
    const session = await auth0.getSession();
    return session?.tokenSet.refreshToken as string;
  },
});

export { auth0AI };
