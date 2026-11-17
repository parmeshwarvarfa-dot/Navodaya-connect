import test from "node:test";
import assert from "node:assert/strict";
import { isEligibleForCommunityGroup, type GroupAccessGroup, type GroupAccessUser } from "./group-access";

const student: GroupAccessUser = {
  role: "student", jnvName: "JNV Jaipur", jnvState: "Rajasthan", class: "10A", passoutYear: null, house: "Aravali",
};

const group = (overrides: Partial<GroupAccessGroup> = {}): GroupAccessGroup => ({
  name: "Study Circle", subject: "Study Group", class: null, jnvName: "JNV Jaipur", jnvState: "Rajasthan", clubId: null, ...overrides,
});

test("school groups require the same verified school name and state", () => {
  assert.equal(isEligibleForCommunityGroup(group(), student), true);
  assert.equal(isEligibleForCommunityGroup(group({ jnvName: "JNV Ajmer" }), student), false);
  assert.equal(isEligibleForCommunityGroup(group({ jnvState: "Gujarat" }), student), false);
});

test("class groups require a student in the matching grade", () => {
  assert.equal(isEligibleForCommunityGroup(group({ name: "Class 10", subject: "Class community", class: "10" }), student), true);
  assert.equal(isEligibleForCommunityGroup(group({ name: "Class 11", subject: "Class community", class: "11" }), student), false);
  assert.equal(isEligibleForCommunityGroup(group({ name: "Class 10", subject: "Class community", class: "10" }), { ...student, role: "alumni" }), false);
});

test("alumni batches and the alumni network require the matching passout year", () => {
  const alumni: GroupAccessUser = { ...student, role: "alumni", class: null, passoutYear: "2020" };
  assert.equal(isEligibleForCommunityGroup(group({ name: "Batch 2020", subject: "Alumni batch", class: "2020" }), alumni), true);
  assert.equal(isEligibleForCommunityGroup(group({ name: "Batch 2021", subject: "Alumni batch", class: "2021" }), alumni), false);
  assert.equal(isEligibleForCommunityGroup(group({ name: "JNV Alumni Network", subject: "Interest community", jnvName: null, jnvState: null }), student), false);
});

test("house and global community access are scoped to their intended audience", () => {
  assert.equal(isEligibleForCommunityGroup(group({ name: "Aravali House", subject: "House community" }), student), true);
  assert.equal(isEligibleForCommunityGroup(group({ name: "Nilgiri House", subject: "House community" }), student), false);
  assert.equal(isEligibleForCommunityGroup(group({ name: "All Navodayans", subject: "All Navodayans", jnvName: null, jnvState: null }), student), true);
  assert.equal(isEligibleForCommunityGroup(group({ name: "Unknown", subject: "Unknown", jnvName: null, jnvState: null }), student), false);
});

test("private and club-backed groups are never granted through community eligibility", () => {
  assert.equal(isEligibleForCommunityGroup(group({ subject: "Private chat group" }), student), false);
  assert.equal(isEligibleForCommunityGroup(group({ subject: "Private chat group", groupType: "school_managed" }), student), true);
  assert.equal(isEligibleForCommunityGroup(group({ clubId: "club-id" }), student), false);
});

test("staff groups are never discoverable through school-community eligibility", () => {
  assert.equal(isEligibleForCommunityGroup(group({ name: "Staff Group", subject: "Staff Group", groupType: "staff_managed", jnvId: "school-id" }), student), false);
  assert.equal(isEligibleForCommunityGroup(group({ name: "Staff Group", subject: "Staff Group", groupType: "staff_managed", jnvId: "school-id" }), { ...student, role: "teacher" }), false);
});
