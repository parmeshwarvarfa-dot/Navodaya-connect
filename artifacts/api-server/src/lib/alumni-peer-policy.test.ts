import assert from "node:assert/strict";
import test from "node:test";
import { alumniPeerEligibility, hasValidAlumniSchool, type PeerIdentity } from "./alumni-peer-policy";
import { makeJnvId } from "./jnv-identity";

const alum = (id: string, school = "JNV Ratlam-I", state = "Madhya Pradesh", status = "unverified", role = "alumni"): PeerIdentity => ({
  id, role, jnvName: school, jnvState: state, jnvId: makeJnvId(state, school), verificationStatus: status,
});

test("valid stored school associations use a directory school and matching stable id", () => {
  assert.equal(hasValidAlumniSchool(alum("a")), true);
  assert.equal(hasValidAlumniSchool(alum("a", "JNV Ratlam")), false);
  assert.equal(hasValidAlumniSchool({ ...alum("a"), jnvId: "jnv:other:school" }), false);
});

test("unverified, community-verified, and legacy-approved alumni can confirm peers", () => {
  assert.equal(alumniPeerEligibility(alum("one", "JNV Ratlam-I", "Madhya Pradesh", "unverified"), alum("two")), "eligible");
  assert.equal(alumniPeerEligibility(alum("one", "JNV Ratlam-I", "Madhya Pradesh", "community_verified"), alum("two")), "eligible");
  assert.equal(alumniPeerEligibility(alum("one", "JNV Ratlam-I", "Madhya Pradesh", "verified"), alum("two")), "eligible");
});

test("students, teachers, and officials cannot use the alumni peer route", () => {
  for (const role of ["student", "teacher", "official"]) assert.equal(alumniPeerEligibility(alum("actor", undefined, undefined, undefined, role), alum("applicant")), "role");
  assert.equal(alumniPeerEligibility(alum("actor"), alum("applicant", undefined, undefined, undefined, "student")), "role");
});

test("self confirmation and cross-JNV confirmation are denied", () => {
  assert.equal(alumniPeerEligibility(alum("same"), alum("same")), "self");
  assert.equal(alumniPeerEligibility(alum("actor"), alum("applicant", "JNV Ratlam-II")), "school");
});

test("moderation restricted accounts cannot confirm or receive a confirmation", () => {
  for (const status of ["under_review", "suspended", "revoked"]) {
    assert.equal(alumniPeerEligibility(alum("actor", undefined, undefined, status), alum("applicant")), "restricted");
    assert.equal(alumniPeerEligibility(alum("actor"), alum("applicant", undefined, undefined, status)), "restricted");
  }
});
