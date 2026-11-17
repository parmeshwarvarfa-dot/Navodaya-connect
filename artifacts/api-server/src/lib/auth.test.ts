import assert from "node:assert/strict";
import test from "node:test";
import { getUser, isCommunityVerifiedAlumni, isVerifiedTeacher, requireAuth } from "./auth";

test("getUser reads the authenticated database user context", () => {
  const user = { id: "user-1", role: "student" };
  assert.equal(getUser({ currentUser: user } as never), user);
});

test("verified teacher capability requires the server-verified status", () => {
  assert.equal(isVerifiedTeacher({ role: "teacher", verificationStatus: "verified" } as never), true);
  assert.equal(isVerifiedTeacher({ role: "teacher", verificationStatus: "unverified" } as never), false);
  assert.equal(isVerifiedTeacher({ role: "student", verificationStatus: "verified" } as never), false);
});

test("alumni community capability requires peer status plus the recorded proof timestamp", () => {
  assert.equal(isCommunityVerifiedAlumni({ role: "alumni", verificationStatus: "community_verified", communityVerifiedAt: new Date() } as never), true);
  assert.equal(isCommunityVerifiedAlumni({ role: "alumni", verificationStatus: "community_verified", communityVerifiedAt: null } as never), false);
  assert.equal(isCommunityVerifiedAlumni({ role: "alumni", verificationStatus: "verified", communityVerifiedAt: null } as never), false);
  assert.equal(isCommunityVerifiedAlumni({ role: "student", verificationStatus: "community_verified", communityVerifiedAt: new Date() } as never), false);
  assert.equal(isCommunityVerifiedAlumni({ role: "alumni", verificationStatus: "suspended", communityVerifiedAt: new Date() } as never), false);
});

test("authentication rejects requests without a bearer token", async () => {
  let statusCode: number | undefined;
  let responseBody: unknown;
  let nextCalled = false;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  };

  await requireAuth(
    { headers: {} } as never,
    response as never,
    (() => { nextCalled = true; }) as never,
  );

  assert.equal(statusCode, 401);
  assert.deepEqual(responseBody, { error: "Unauthorized" });
  assert.equal(nextCalled, false);
});
