import test from "node:test";
import assert from "node:assert/strict";
import { initialGroupMemberRole, mayChangeGroupMemberRole, supportsAdminOnlyMessages, supportsGroupAdminRoles } from "./group-administration";

test("user-created and school-managed groups grant the creator group-scoped admin", () => {
  assert.equal(initialGroupMemberRole("user_created", "creator", "creator"), "admin");
  assert.equal(initialGroupMemberRole("school_managed", "creator", "creator"), "admin");
  assert.equal(initialGroupMemberRole("user_created", "invitee", "creator"), "member");
});

test("system, class-based, club, staff, and legacy group creation never infers an admin", () => {
  for (const groupType of ["system_created", "class_based", "club_managed", "staff_managed", "legacy"] as const) {
    assert.equal(initialGroupMemberRole(groupType, "creator", "creator"), "member");
  }
});

test("only an existing admin can change another member role in user-created or school-managed groups", () => {
  assert.equal(mayChangeGroupMemberRole("user_created", "admin", "member", "admin"), true);
  assert.equal(mayChangeGroupMemberRole("school_managed", "admin", "member", "admin"), true);
  assert.equal(mayChangeGroupMemberRole("user_created", "member", "other", "member"), false);
  assert.equal(mayChangeGroupMemberRole("user_created", "admin", "admin", "admin"), false);
  assert.equal(mayChangeGroupMemberRole("legacy", "admin", "member", "admin"), false);
  assert.equal(mayChangeGroupMemberRole("club_managed", "admin", "member", "admin"), false);
  assert.equal(mayChangeGroupMemberRole("staff_managed", "admin", "member", "admin"), false);
  assert.equal(supportsGroupAdminRoles("system_created"), false);
  assert.equal(supportsGroupAdminRoles("class_based"), false);
  assert.equal(supportsAdminOnlyMessages("user_created"), true);
  assert.equal(supportsAdminOnlyMessages("staff_managed"), true);
  assert.equal(supportsAdminOnlyMessages("club_managed"), true);
  assert.equal(supportsAdminOnlyMessages("system_created"), false);
  assert.equal(supportsAdminOnlyMessages("legacy"), false);
});
