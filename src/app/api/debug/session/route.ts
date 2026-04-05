import { auth0 } from "@/lib/auth0";

export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return Response.json({ error: "No session" }, { status: 401 });
  }

  return Response.json({
    user: {
      sub: session.user.sub,
      name: session.user.name,
      email: session.user.email,
    },
    tokenSet: {
      hasAccessToken: !!session.tokenSet?.accessToken,
      hasRefreshToken: !!session.tokenSet?.refreshToken,
      hasIdToken: !!session.tokenSet?.idToken,
      keys: session.tokenSet ? Object.keys(session.tokenSet) : [],
      scope: session.tokenSet?.scope,
      expiresAt: session.tokenSet?.expiresAt,
    },
  });
}
