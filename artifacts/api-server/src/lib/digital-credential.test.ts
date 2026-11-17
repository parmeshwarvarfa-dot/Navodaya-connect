import assert from "node:assert/strict";
import test from "node:test";
import { issueDigitalCredential } from "./digital-credential";

const fakeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Test User",
  role: "student",
  jnvName: "JNV Example",
  jnvState: "Example State",
} as never;

function credentialTx(initial: Record<string, unknown> | null = null) {
  let active = initial;
  let inserted = 0;
  let lastValues: Record<string, unknown> | null = null;
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => active ? [active] : [] }) }) }),
    update: () => ({ set: (updates: Record<string, unknown>) => ({ where: async () => {
      if (active) active = { ...active, ...updates };
    } }) }),
    insert: () => ({ values: (values: Record<string, unknown>) => {
      lastValues = values;
      return { onConflictDoNothing: () => ({ returning: async () => {
        inserted += 1;
        active = { id: `credential-${inserted}`, status: "active", ...values };
        return [active];
      } }) };
    } }),
  };
  return { tx: tx as never, count: () => inserted, values: () => lastValues };
}

test("issues a random role-prefixed ID and opaque public token", async () => {
  const store = credentialTx();
  const result = await issueDigitalCredential(store.tx, fakeUser, "jnv:example", "official-1", "student");
  assert.equal(result.created, true);
  assert.match(result.credential.credentialId, /^NC-STU-[A-F0-9]{10}$/);
  assert.match(result.credential.publicToken, /^[A-Za-z0-9_-]{40,50}$/);
  assert.equal(store.count(), 1);
});

test("repeated approval preserves the existing active ID", async () => {
  const existing = { id: "existing", credentialId: "NC-STU-0123456789", publicToken: "opaque-token", role: "student", status: "active" };
  const store = credentialTx(existing);
  const result = await issueDigitalCredential(store.tx, fakeUser, "jnv:example", "official-1", "student");
  assert.equal(result.created, false);
  assert.equal(result.credential.credentialId, existing.credentialId);
  assert.equal(store.count(), 0);
});

test("rejects issuance for unsupported roles", async () => {
  const store = credentialTx();
  await assert.rejects(issueDigitalCredential(store.tx, fakeUser, "jnv:example", "official-1", "guest"), /Unsupported role/);
  assert.equal(store.count(), 0);
});

test("does not supersede an alumni ID through school-verification issuance", async () => {
  const existing = { id: "existing", credentialId: "NC-ALU-0123456789", publicToken: "opaque-token", role: "alumni", status: "active" };
  const store = credentialTx(existing);
  await assert.rejects(issueDigitalCredential(store.tx, fakeUser, "jnv:example", "official-1", "student"), /cannot be superseded/);
  assert.equal(store.count(), 0);
  assert.equal(store.values(), null);
});
