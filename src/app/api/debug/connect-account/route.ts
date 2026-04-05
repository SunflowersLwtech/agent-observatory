import { auth0 } from "@/lib/auth0";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.tokenSet?.refreshToken) {
    return Response.json({ error: "No session/refresh token" }, { status: 401 });
  }

  const connection = req.nextUrl.searchParams.get("connection") ?? "github";

  // Step 1: Exchange refresh token for My Account API access token
  const tokenRes = await fetch("https://sunflowers.us.auth0.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      refresh_token: session.tokenSet.refreshToken,
      audience: "https://sunflowers.us.auth0.com/me/",
      scope: "openid profile create:me:connected_accounts read:me:connected_accounts",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    return Response.json({ step: "get_my_account_token", error: err }, { status: 400 });
  }

  const { access_token } = await tokenRes.json();

  // Step 2: Check existing connected accounts
  const listRes = await fetch("https://sunflowers.us.auth0.com/me/connected-accounts", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (listRes.ok) {
    const accounts = await listRes.json();
    // Check if connection already exists
    const existing = accounts.find((a: { connection: string }) => a.connection === connection);
    if (existing) {
      return Response.json({ step: "already_connected", accounts });
    }
  }

  // Step 3: Initiate Connected Account linking
  const connectRes = await fetch("https://sunflowers.us.auth0.com/me/connected-accounts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connection,
      redirect_uri: `${process.env.AUTH0_BASE_URL}/close`,
    }),
  });

  const connectData = await connectRes.json();

  if (!connectRes.ok) {
    return Response.json({ step: "connect_account", error: connectData }, { status: 400 });
  }

  // Return the authorize URL for the user to visit
  return Response.json({
    step: "redirect_to_authorize",
    authorize_url: connectData.authorize_url ?? connectData.url ?? connectData,
    message: "Open this URL to connect your account",
  });
}
