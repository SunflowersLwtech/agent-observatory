import { auth0 } from "@/lib/auth0";
import {
  denyScopeForUser,
  allowScopeForUser,
  getAllDeniedScopes,
} from "@/lib/fga/model";
import { recordEvent } from "@/lib/observatory/event-store";

export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { service, scope, enabled } = await req.json();
  const userId = session.user.sub;

  if (enabled) {
    allowScopeForUser(userId, service, scope);
  } else {
    denyScopeForUser(userId, service, scope);
  }

  recordEvent({
    type: "authorization_decision",
    tool: "scope_toggle",
    service,
    scopes: [scope],
    riskLevel: "medium",
    owaspCategories: ["ASI03"],
    outcome: "success",
    details: {
      action: enabled ? "allow_scope" : "deny_scope",
      scope,
      userId,
    },
  });

  return Response.json({
    success: true,
    deniedScopes: getAllDeniedScopes(userId),
  });
}

export async function GET(req: Request) {
  const session = await auth0.getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    deniedScopes: getAllDeniedScopes(session.user.sub),
  });
}
