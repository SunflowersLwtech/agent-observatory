/**
 * FGA Authorization Model for Agent Observatory
 *
 * Implements Relationship-Based Access Control (ReBAC) using OpenFGA concepts.
 * This model ensures that when the AI agent retrieves information for RAG-style
 * operations, it can only access documents the specific user is authorized to see.
 *
 * Addresses OWASP ASI06 (Memory & Context Poisoning) at the authorization layer.
 *
 * In production, this model would be deployed to Auth0 FGA (OpenFGA).
 * For the hackathon demo, we implement the authorization logic in-memory
 * to demonstrate the pattern without requiring an FGA instance.
 */

export interface FGARelationship {
  user: string;
  relation: string;
  object: string;
}

export interface FGAModel {
  type_definitions: Array<{
    type: string;
    relations: Record<string, { this: Record<string, never> }>;
  }>;
}

// The authorization model definition (OpenFGA DSL format)
export const AGENT_OBSERVATORY_MODEL: FGAModel = {
  type_definitions: [
    {
      type: "user",
      relations: {},
    },
    {
      type: "document",
      relations: {
        owner: { this: {} },
        editor: { this: {} },
        viewer: { this: {} },
      },
    },
    {
      type: "service",
      relations: {
        admin: { this: {} },
        user: { this: {} },
      },
    },
    {
      type: "agent_action",
      relations: {
        approver: { this: {} },
        executor: { this: {} },
      },
    },
  ],
};

// In-memory relationship store (demo implementation)
const relationships: FGARelationship[] = [];

export function addRelationship(rel: FGARelationship): void {
  const exists = relationships.some(
    (r) =>
      r.user === rel.user &&
      r.relation === rel.relation &&
      r.object === rel.object
  );
  if (!exists) {
    relationships.push(rel);
  }
}

export function checkPermission(
  user: string,
  relation: string,
  object: string
): boolean {
  return relationships.some(
    (r) => r.user === user && r.relation === relation && r.object === object
  );
}

export function getUserRelationships(user: string): FGARelationship[] {
  return relationships.filter((r) => r.user === user);
}

/**
 * Initialize default relationships for a user.
 * Called when a user first authenticates to set up their service permissions.
 */
export function initializeUserPermissions(userId: string): void {
  // User has access to their own connected services
  addRelationship({
    user: `user:${userId}`,
    relation: "user",
    object: "service:google-calendar",
  });
  addRelationship({
    user: `user:${userId}`,
    relation: "user",
    object: "service:github",
  });
  addRelationship({
    user: `user:${userId}`,
    relation: "user",
    object: "service:slack",
  });

  // User is the approver for high-risk agent actions
  addRelationship({
    user: `user:${userId}`,
    relation: "approver",
    object: "agent_action:write_operations",
  });
}

/**
 * Check if a user can perform an agent action.
 * Used for step-up authorization on high-risk operations.
 */
export function canPerformAgentAction(
  userId: string,
  action: string
): boolean {
  return checkPermission(`user:${userId}`, "approver", `agent_action:${action}`);
}

/**
 * Check if a user has access to a specific service.
 */
export function canAccessService(
  userId: string,
  service: string
): boolean {
  return checkPermission(`user:${userId}`, "user", `service:${service}`);
}

// ============================================================================
// SCOPE-LEVEL AUTHORIZATION (Per-scope toggle control)
// Enables granular consent: allow channels:read but deny chat:write
// ============================================================================

const deniedScopes: Map<string, Set<string>> = new Map();

/**
 * Deny a specific scope for a user on a service.
 */
export function denyScopeForUser(
  userId: string,
  service: string,
  scope: string
): void {
  const key = `${userId}:${service}`;
  if (!deniedScopes.has(key)) {
    deniedScopes.set(key, new Set());
  }
  deniedScopes.get(key)!.add(scope);
}

/**
 * Allow a previously denied scope for a user on a service.
 */
export function allowScopeForUser(
  userId: string,
  service: string,
  scope: string
): void {
  const key = `${userId}:${service}`;
  deniedScopes.get(key)?.delete(scope);
}

/**
 * Check if a specific scope is denied for a user.
 */
export function isScopeDenied(
  userId: string,
  service: string,
  scope: string
): boolean {
  const key = `${userId}:${service}`;
  return deniedScopes.get(key)?.has(scope) ?? false;
}

/**
 * Get all denied scopes for a user on a service.
 */
export function getDeniedScopes(
  userId: string,
  service: string
): string[] {
  const key = `${userId}:${service}`;
  return Array.from(deniedScopes.get(key) ?? []);
}

/**
 * Get all denied scopes across all services for a user.
 */
export function getAllDeniedScopes(
  userId: string
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, scopes] of deniedScopes.entries()) {
    if (key.startsWith(`${userId}:`)) {
      const service = key.slice(userId.length + 1);
      result[service] = Array.from(scopes);
    }
  }
  return result;
}
