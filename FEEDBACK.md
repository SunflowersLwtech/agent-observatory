# Auth0 Product Feedback — Agent Observatory

> Submitted for the Feedback Prize at the "Authorized to Act" Hackathon
> Based on systematic review of auth0-ai-js, auth0-ai-python, auth0-ai-samples repos, 40+ GitHub issues, Auth0 Community Forum, and building a production application with Token Vault + FGA.

---

## 1. Token Vault needs a diagnostic API endpoint

**Issue**: Token Vault setup requires ~10 configuration steps. When any step fails, the error is always the same: `Federated connection Refresh Token not found`. There is no way to determine which step failed — was it the grant type? The social connection? The MRRT policy? The My Account API?

**Evidence**: [auth0-ai-samples#66](https://github.com/auth0-samples/auth0-ai-samples/issues/66) — Developer followed every step correctly and still got the same error. Multiple Devpost forum threads describe the same problem.

**Suggestion**: Add a `GET /api/v2/token-vault/diagnostics` endpoint that returns the configuration status of each prerequisite:
```json
{
  "token_exchange_grant": true,
  "mrrt_enabled": true,
  "my_account_api": true,
  "connections": {
    "google-oauth2": {
      "connected_accounts_enabled": true,
      "offline_access": true,
      "has_stored_tokens": false,
      "last_error": "User has not completed OAuth consent"
    }
  }
}
```

**Impact**: Would reduce Token Vault setup time from hours to minutes. Every developer using Auth0 for AI Agents would benefit.

---

## 2. Federated connection errors should not be silently discarded

**Issue**: In `@auth0/ai-vercel` (and the base `@auth0/ai` package), errors from the federated connection token exchange flow are caught and silently discarded in `TokenVaultAuthorizerBase`. When Token Vault fails, developers and users receive no signal at all.

**Evidence**: [auth0-ai-js#175](https://github.com/auth0/auth0-ai-js/issues/175) (OPEN) — The error is caught at the SDK level with no logging, no error propagation, and no user notification.

**Suggestion**: At minimum, add `console.warn()` logging. Ideally, expose an `onTokenVaultError` callback in the `withTokenVault` options so developers can handle failures explicitly:
```typescript
auth0AI.withTokenVault({
  connection: "google-oauth2",
  scopes: [...],
  refreshToken: async () => ...,
  onError: (error, context) => {
    // Developer can log, record metrics, or surface to user
    observatoryLog(error, context);
  }
});
```

**Impact**: Eliminates the most confusing debugging experience in the Auth0 AI SDK. Our Observatory project had to wrap every tool call in try/catch as a workaround.

---

## 3. Add post-authentication event logging to Auth0 Logs

**Issue**: Auth0 Logs capture authentication events (login, logout, token refresh) but not Token Vault events (token exchange, federated connection access, credential retrieval). After a user authenticates, there is no Auth0-native way to see what the AI agent did with the granted credentials.

**Evidence**: RSAC 2026 analysis (VentureBeat) identified that all 5 major agent identity frameworks lack post-authentication monitoring. This is the gap our Observatory project addresses.

**Suggestion**: Add Token Vault events to Auth0 Logs:
- `tv_exchange_success` — Successful token exchange
- `tv_exchange_failure` — Failed token exchange (with error code)
- `tv_token_refresh` — Token refresh cycle
- `tv_connection_revoke` — User revoked a connected account

**Impact**: Enables compliance teams to audit AI agent behavior. Addresses the #1 gap identified by security researchers at RSAC 2026.

---

## 4. Expose OAuth scope risk classification

**Issue**: OAuth scopes already encode what an agent *can* do, but there's no first-party API for classifying scopes by risk level. Every developer building agent authorization has to manually classify `calendar.freebusy` (low risk) vs `gmail.send` (high risk) vs `repo` (medium risk).

**Suggestion**: Add a `GET /api/v2/connections/{connection}/scopes` endpoint that returns scopes with risk metadata:
```json
{
  "scopes": [
    { "name": "calendar.freebusy", "risk": "low", "type": "read" },
    { "name": "calendar.events", "risk": "high", "type": "write" },
    { "name": "gmail.send", "risk": "critical", "type": "write" }
  ]
}
```

**Impact**: Enables automated risk-based authorization decisions. We implemented this as "Scope-Bound Risk Classification" (Pattern 2) in our project — it could be a first-party Auth0 feature.

---

## 5. useInterruptions type incompatibility with custom useChat generics

**Issue**: The `useInterruptions` hook from `@auth0/ai-vercel/react` forces `UIMessage<unknown, UIDataTypes, UITools>` as the return type, which conflicts with custom generic types on `useChat`. This prevents TypeScript projects from using typed tool results alongside Token Vault interrupts.

**Evidence**: [auth0-ai-js#258](https://github.com/auth0/auth0-ai-js/issues/258) (OPEN)

**Suggestion**: Make `useInterruptions` generic so it preserves the caller's `useChat` type parameter:
```typescript
export function useInterruptions<T extends GeneralChatReturnType<M>, M extends UIMessage>(
  useChatCreator: (errorHandler: ErrorHandler) => T
): T & { toolInterrupt: Auth0InterruptionUI | null };
```

**Impact**: Unblocks type-safe AI applications using both Auth0 interrupts and Vercel AI SDK's typed tool parts.

---

## 6. MCP tutorial needs fix (auth0-ai-samples#62)

**Issue**: The official Auth0 for MCP tutorial (Python FastMCP) produces `StreamableHTTPError: Missing Authorization header` for all participants. 7+ comments on the issue with no resolution.

**Evidence**: [auth0-ai-samples#62](https://github.com/auth0-samples/auth0-ai-samples/issues/62) (OPEN)

**Suggestion**: Update the tutorial to use the correct authorization header configuration. Our project chose to focus on the Vercel AI SDK pattern (which works correctly) rather than MCP because of this issue.

**Impact**: Unblocks MCP adoption for Auth0 AI developers.
