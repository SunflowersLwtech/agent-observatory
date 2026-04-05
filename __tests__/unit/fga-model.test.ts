import { describe, it, expect } from "vitest";
import {
  addRelationship,
  checkPermission,
  getUserRelationships,
  initializeUserPermissions,
  canAccessService,
  canPerformAgentAction,
  denyScopeForUser,
  allowScopeForUser,
  isScopeDenied,
  getDeniedScopes,
  getAllDeniedScopes,
  AGENT_OBSERVATORY_MODEL,
} from "@/lib/fga/model";

/**
 * NOTE: The FGA model uses a module-level array for relationships.
 * Tests in this file must be aware that state persists between tests
 * within the same module execution. We use unique userIds per test
 * to isolate them.
 */

// ============================================================================
// Model definition
// ============================================================================
describe("AGENT_OBSERVATORY_MODEL", () => {
  it("defines 4 types: user, document, service, agent_action", () => {
    const types = AGENT_OBSERVATORY_MODEL.type_definitions.map((t) => t.type);
    expect(types).toEqual(["user", "document", "service", "agent_action"]);
  });

  it("document type has owner, editor, viewer relations", () => {
    const doc = AGENT_OBSERVATORY_MODEL.type_definitions.find(
      (t) => t.type === "document"
    )!;
    expect(Object.keys(doc.relations)).toEqual(["owner", "editor", "viewer"]);
  });

  it("service type has admin and user relations", () => {
    const svc = AGENT_OBSERVATORY_MODEL.type_definitions.find(
      (t) => t.type === "service"
    )!;
    expect(Object.keys(svc.relations)).toEqual(["admin", "user"]);
  });
});

// ============================================================================
// addRelationship & checkPermission
// ============================================================================
describe("addRelationship & checkPermission", () => {
  it("adds and checks a relationship", () => {
    addRelationship({ user: "user:add-1", relation: "viewer", object: "document:doc1" });
    expect(checkPermission("user:add-1", "viewer", "document:doc1")).toBe(true);
  });

  it("returns false for non-existent relationship", () => {
    expect(checkPermission("user:noexist", "admin", "service:nope")).toBe(false);
  });

  it("does not add duplicate relationships", () => {
    addRelationship({ user: "user:dup-1", relation: "user", object: "service:google" });
    addRelationship({ user: "user:dup-1", relation: "user", object: "service:google" });
    const rels = getUserRelationships("user:dup-1");
    const matching = rels.filter(
      (r) => r.relation === "user" && r.object === "service:google"
    );
    expect(matching).toHaveLength(1);
  });
});

// ============================================================================
// initializeUserPermissions
// ============================================================================
describe("initializeUserPermissions", () => {
  it("grants access to all 3 services", () => {
    initializeUserPermissions("init-user-1");
    expect(canAccessService("init-user-1", "google-calendar")).toBe(true);
    expect(canAccessService("init-user-1", "github")).toBe(true);
    expect(canAccessService("init-user-1", "slack")).toBe(true);
  });

  it("sets user as approver for write_operations", () => {
    initializeUserPermissions("init-user-2");
    expect(canPerformAgentAction("init-user-2", "write_operations")).toBe(true);
  });

  it("does not grant access to unknown services", () => {
    initializeUserPermissions("init-user-3");
    expect(canAccessService("init-user-3", "salesforce")).toBe(false);
  });
});

// ============================================================================
// canAccessService
// ============================================================================
describe("canAccessService", () => {
  it("returns false for user without permissions", () => {
    expect(canAccessService("unregistered-user", "google-calendar")).toBe(false);
  });
});

// ============================================================================
// Scope-level authorization (deny/allow/check)
// ============================================================================
describe("Scope-level authorization", () => {
  const userId = "scope-user-1";
  const service = "slack";

  it("scope is NOT denied by default", () => {
    expect(isScopeDenied(userId, service, "chat:write")).toBe(false);
  });

  it("denyScopeForUser marks scope as denied", () => {
    denyScopeForUser(userId, service, "chat:write");
    expect(isScopeDenied(userId, service, "chat:write")).toBe(true);
  });

  it("allowScopeForUser re-allows a denied scope", () => {
    denyScopeForUser(userId, service, "channels:read");
    allowScopeForUser(userId, service, "channels:read");
    expect(isScopeDenied(userId, service, "channels:read")).toBe(false);
  });

  it("getDeniedScopes returns all denied scopes for a service", () => {
    const uid = "scope-user-2";
    denyScopeForUser(uid, "github", "repo");
    denyScopeForUser(uid, "github", "write:repo");
    const denied = getDeniedScopes(uid, "github");
    expect(denied).toContain("repo");
    expect(denied).toContain("write:repo");
    expect(denied).toHaveLength(2);
  });

  it("getAllDeniedScopes groups by service", () => {
    const uid = "scope-user-3";
    denyScopeForUser(uid, "slack", "chat:write");
    denyScopeForUser(uid, "github", "repo");
    const all = getAllDeniedScopes(uid);
    expect(all.slack).toContain("chat:write");
    expect(all.github).toContain("repo");
  });

  it("getAllDeniedScopes returns empty object for user with no denials", () => {
    const all = getAllDeniedScopes("clean-user-no-denials");
    expect(Object.keys(all)).toHaveLength(0);
  });

  it("denying same scope twice does not duplicate", () => {
    const uid = "scope-user-4";
    denyScopeForUser(uid, "slack", "chat:write");
    denyScopeForUser(uid, "slack", "chat:write");
    expect(getDeniedScopes(uid, "slack")).toHaveLength(1);
  });
});
