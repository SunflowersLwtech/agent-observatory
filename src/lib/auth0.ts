import { Auth0Client } from "@auth0/nextjs-auth0/server";

let _auth0: Auth0Client | null = null;

export const auth0 = new Proxy({} as Auth0Client, {
  get(_target, prop) {
    if (!_auth0) {
      _auth0 = new Auth0Client();
    }
    const value = (_auth0 as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(_auth0);
    }
    return value;
  },
});
