import { auth0 } from "@/lib/auth0";

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.tokenSet?.refreshToken) {
    return Response.json({ error: "No refresh token" }, { status: 401 });
  }

  // Try the Token Vault exchange directly
  const res = await fetch("https://sunflowers.us.auth0.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      subject_token_type: "urn:ietf:params:oauth:token-type:refresh_token",
      subject_token: session.tokenSet.refreshToken,
      connection: "github",
      requested_token_type: "http://auth0.com/oauth/token-type/federated-connection-access-token",
    }),
  });

  const body = await res.json();
  return Response.json({
    status: res.status,
    ok: res.ok,
    body: res.ok ? { access_token: "***", scope: body.scope, expires_in: body.expires_in } : body,
  });
}
