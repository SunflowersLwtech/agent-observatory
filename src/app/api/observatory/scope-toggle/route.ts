import { z } from "zod";
import { auth0 } from "@/lib/auth0";
import {
  denyScopeForUser,
  allowScopeForUser,
  getAllDeniedScopes,
} from "@/lib/fga/model";
import { recordEvent } from "@/lib/observatory/event-store";

const ScopeToggleSchema = z.object({
  service: z.string().min(1),
  scope: z.string().min(1),
  enabled: z.boolean(),
});

export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = ScopeToggleSchema.safeParse(body);
  if (!parseResult.success) {
    return Response.json(
      { error: "Invalid request body", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const { service, scope, enabled } = parseResult.data;
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

export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    deniedScopes: getAllDeniedScopes(session.user.sub),
  });
}
