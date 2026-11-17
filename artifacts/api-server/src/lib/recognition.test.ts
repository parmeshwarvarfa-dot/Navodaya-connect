import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextMonth, recognitionProfileComplete } from "./recognition";

describe("recognition policy", () => {
  it("requires role-relevant profile fields before awarding completion points", () => {
    const base = { fullName: "Navodayan", jnvName: "JNV Example", jnvState: "State", verificationStatus: "verified" };
    assert.equal(recognitionProfileComplete({ ...base, role: "student", class: "Class 12" }), true);
    assert.equal(recognitionProfileComplete({ ...base, role: "student" }), false);
    assert.equal(recognitionProfileComplete({ ...base, role: "alumni", passoutYear: "2020" }), true);
    assert.equal(recognitionProfileComplete({ ...base, role: "teacher", subject: "Mathematics" }), true);
    assert.equal(recognitionProfileComplete({ ...base, role: "official", designation: "Principal" }), true);
    assert.equal(recognitionProfileComplete({ ...base, role: "alumni", passoutYear: " " }), false);
  });

  it("advances monthly award periods across calendar year boundaries", () => {
    assert.equal(nextMonth("2026-01"), "2026-02");
    assert.equal(nextMonth("2026-11"), "2026-12");
    assert.equal(nextMonth("2026-12"), "2027-01");
  });
});
