import { auth0 } from "@/lib/auth0";
import { updateTokenState, recordEvent } from "@/lib/observatory/event-store";

export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connection, service } = await req.json();

  // Record the revocation event
  recordEvent({
    type: "authorization_decision",
    tool: "revoke_connection",
    service: service ?? connection,
    scopes: [],
    riskLevel: "medium",
    owaspCategories: ["ASI03"],
    outcome: "success",
    details: {
      action: "revoke",
      connection,
      userId: session.user.sub,
      revokedAt: new Date().toISOString(),
    },
  });

  // Update token state to disconnected
  updateTokenState(service ?? connection, {
    service,
    connection,
    status: "disconnected",
    healthScore: 0,
    errorMessage: "Connection revoked by user",
  });

  // Attempt to revoke via Auth0 Management API (best-effort)
  // DELETE /api/v2/users/{userId}/identities/{provider}/{user_id}
  const managementApiRevoked = await revokeViaManagementAPI(
    session.user.sub,
    connection
  );

  return Response.json({
    success: true,
    managementApiRevoked,
    message: `Connection to ${service} has been revoked`,
  });
}

/**
 * Attempt to revoke a federated connection via Auth0 Management API.
 * Requires a Management API token with delete:user_idp_tokens scope.
 * Falls back gracefully if Management API is not configured.
 */
async function revokeViaManagementAPI(
  userId: string,
  connection: string
): Promise<boolean> {
  const domain = process.env.AUTH0_ISSUER_BASE_URL;
  const mgmtToken = process.env.AUTH0_MGMT_API_TOKEN;

  if (!domain || !mgmtToken) {
    // Management API not configured — local-only revocation
    return false;
  }

  try {
    const res = await fetch(
      `${domain}/api/v2/users/${encodeURIComponent(userId)}/identities/${encodeURIComponent(connection)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
