import { Auth0Client } from "@auth0/nextjs-auth0/server";

let _auth0: Auth0Client | null = null;

export const auth0 = new Proxy({} as Auth0Client, {
  get(_target, prop) {
    if (!_auth0) {
      // AUTH0_DOMAIN is required by the SDK but the project uses AUTH0_ISSUER_BASE_URL.
      // Derive domain by stripping the protocol prefix when AUTH0_DOMAIN is not set.
      const domain =
        process.env.AUTH0_DOMAIN ??
        process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, "");
      _auth0 = new Auth0Client(domain ? { domain } : undefined);
    }
    const value = (_auth0 as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(_auth0);
    }
    return value;
  },
});
