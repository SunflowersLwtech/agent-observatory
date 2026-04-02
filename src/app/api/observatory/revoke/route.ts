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

  // In production, this would call Auth0 Management API to remove the
  // user's federated connection. For the hackathon demo, we update
  // the local state to show the revocation flow.
  // Production code: DELETE /api/v2/users/{userId}/identities/{provider}/{user_id}

  return Response.json({
    success: true,
    message: `Connection to ${service} has been revoked`,
  });
}
