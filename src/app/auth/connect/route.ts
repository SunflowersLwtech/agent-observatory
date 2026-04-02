import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

/**
 * Auth0 Connected Accounts route.
 * Opens the Auth0 consent flow for connecting external services via Token Vault.
 * Used by the TokenVaultConsentPopup component.
 *
 * Query params:
 * - connection: The Auth0 social connection name (e.g., "google-oauth2")
 * - scopes: Required OAuth scopes (can be repeated)
 * - returnTo: Where to redirect after completion (default: /close)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const connection = searchParams.get("connection");
  const returnTo = searchParams.get("returnTo") ?? "/close";
  const scopes = searchParams.getAll("scopes");

  if (!connection) {
    return new Response("Missing connection parameter", { status: 400 });
  }

  // Build the Auth0 Connected Accounts URL
  // This uses the My Account API to connect the user's external account
  const session = await auth0.getSession();
  if (!session) {
    // Redirect to login first, then back to connect
    return NextResponse.redirect(
      new URL(`/auth/login?returnTo=${encodeURIComponent(req.url)}`, req.url)
    );
  }

  const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_CLIENT_ID;

  // Auth0 Connected Accounts flow URL
  const connectUrl = new URL(`${issuerBaseUrl}/authorize`);
  connectUrl.searchParams.set("client_id", clientId!);
  connectUrl.searchParams.set("response_type", "code");
  connectUrl.searchParams.set(
    "redirect_uri",
    new URL(returnTo, req.url).toString()
  );
  connectUrl.searchParams.set("connection", connection);
  connectUrl.searchParams.set("scope", ["openid", "profile", ...scopes].join(" "));
  connectUrl.searchParams.set("prompt", "consent");

  return NextResponse.redirect(connectUrl.toString());
}
