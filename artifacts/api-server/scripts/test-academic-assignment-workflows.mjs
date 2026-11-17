import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "../../..");
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") process.loadEnvFile(path.join(workspaceRoot, ".env"));
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing; add it to the workspace .env file.");

const { Pool } = createRequire(path.join(workspaceRoot, "lib/db/package.json"))("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const apiBase = (process.env.ACADEMIC_ASSIGNMENT_TEST_BASE_URL ?? "http://127.0.0.1:3001/api").replace(/\/$/, "");
const unique = randomUUID();
const officialJnvId = `academic-test-${unique}`;
const otherJnvId = `academic-test-other-${unique}`;
const officialJnvName = `JNV Assignment Test ${unique.slice(0, 8)}`;
const state = "Academic Assignment Test";
const ids = Object.fromEntries(["official", "unassignedOfficial", "otherOfficial", "teacherOne", "teacherTwo", "studentA", "studentB", "studentC", "studentD", "studentE", "alumni"].map((key) => [key, randomUUID()]));
const tokens = Object.fromEntries(["official", "unassignedOfficial", "otherOfficial", "teacherOne", "teacherTwo", "studentA", "alumni"].map((key) => [key, randomUUID()]));
const currentAcademicYear = () => {
  const today = new Date(); const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${year}-${year + 1}`;
};

async function api(method, route, { token, body } = {}) {
  const response = await fetch(`${apiBase}${route}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}

function expectStatus(result, status, context) {
  assert.equal(result.status, status, `${context}: expected HTTP ${status}; got ${result.status}: ${JSON.stringify(result.data)}`);
}

const jnvIds = [officialJnvId, otherJnvId];
const userIds = Object.values(ids);
const userRecords = [
  { key: "official", name: "Academic Test Official", role: "official", jnvId: officialJnvId, jnvName: officialJnvName, verification: "verified" },
  { key: "unassignedOfficial", name: "Unassigned Official", role: "official", jnvId: officialJnvId, jnvName: officialJnvName, verification: "verified" },
  { key: "otherOfficial", name: "Other JNV Official", role: "official", jnvId: otherJnvId, jnvName: "Other Test JNV", verification: "verified" },
  { key: "teacherOne", name: "Teacher One", role: "teacher", jnvId: officialJnvId, jnvName: officialJnvName, verification: "verified", subject: "Mathematics" },
  { key: "teacherTwo", name: "Teacher Two", role: "teacher", jnvId: officialJnvId, jnvName: officialJnvName, verification: "verified", subject: "Mathematics" },
  { key: "studentA", name: "Student A", role: "student", jnvId: officialJnvId, jnvName: officialJnvName, verification: "verified", class: "Class 8 A" },
  { key: "studentB", name: "Student B", role: "student", jnvId: officialJnvId, jnvName: officialJnvName, verification: "verified", class: "Class 8 B" },
  { key: "studentC", name: "Student C", role: "student", jnvId: officialJnvId, jnvName: officialJnvName, verification: "verified", class: "Class 9 A" },
  { key: "studentD", name: "Student D", role: "student", jnvId: officialJnvId, jnvName: officialJnvName, verification: "verified", class: "Class 10 A" },
  { key: "studentE", name: "Student E", role: "student", jnvId: officialJnvId, jnvName: officialJnvName, verification: "verified", class: "12" },
  { key: "alumni", name: "Verified Alumni", role: "alumni", jnvId: officialJnvId, jnvName: officialJnvName, verification: "community_verified" },
];

async function cleanup() {
  await pool.query("DELETE FROM teacher_class_assignments WHERE jnv_id = ANY($1::text[])", [jnvIds]);
  await pool.query("DELETE FROM teacher_assignment_audit WHERE jnv_id = ANY($1::text[])", [jnvIds]);
  await pool.query("DELETE FROM jnv_academic_settings WHERE jnv_id = ANY($1::text[])", [jnvIds]);
  await pool.query("DELETE FROM verification_assignments WHERE user_id = ANY($1::uuid[])", [userIds]);
  await pool.query("DELETE FROM sessions WHERE user_id = ANY($1::uuid[])", [userIds]);
  await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
}

try {
  for (const record of userRecords) {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, jnv_state, jnv_name, jnv_id, house, verification_status, class, subject, community_verified_at)
       VALUES ($1, $2, 'academic-test-only', $3, $4, $5, $6, $7, 'Test House', $8, $9, $10, $11)`,
      [ids[record.key], `${record.key}-${unique}@assignment-test.invalid`, record.name, record.role, state, record.jnvName, record.jnvId, record.verification, record.class ?? null, record.subject ?? null, record.role === "alumni" ? new Date() : null],
    );
    if (tokens[record.key]) await pool.query("INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)", [ids[record.key], tokens[record.key], new Date(Date.now() + 60 * 60 * 1000)]);
  }
  for (const key of ["official", "otherOfficial"]) {
    const jnvId = key === "official" ? officialJnvId : otherJnvId;
    const jnvName = key === "official" ? officialJnvName : "Other Test JNV";
    await pool.query("INSERT INTO verification_assignments (user_id, jnv_id, jnv_name, jnv_state, assignment_role, active) VALUES ($1, $2, $3, $4, 'official', true)", [ids[key], jnvId, jnvName, state]);
  }
  expectStatus(await api("GET", "/academic-teacher-assignments/overview"), 401, "Unauthenticated overview");
  expectStatus(await api("GET", "/academic-teacher-assignments/overview", { token: tokens.unassignedOfficial }), 200, "Registered official without a separate admin assignment overview");
  expectStatus(await api("GET", "/academic-teacher-assignments/overview", { token: tokens.studentA }), 403, "Student overview");

  const year = currentAcademicYear();
  const overviewResult = await api("GET", `/academic-teacher-assignments/overview?academicYear=${year}`, { token: tokens.official });
  expectStatus(overviewResult, 200, "Authorized official overview");
  assert.ok(overviewResult.data.teachers.some((row) => row.id === ids.teacherOne), "Overview must load real approved teachers for the official's JNV");
  assert.ok(overviewResult.data.classSections.some((row) => row.className === "Class 8" && row.section === "A"), "Sections must come from actual verified student profiles");
  assert.ok(overviewResult.data.classSections.some((row) => row.className === "Class 12" && row.section === "Unspecified"), "Legacy numeric-only class profiles must still appear as assignable whole-class options");

  const post = (token, body) => api("POST", "/academic-teacher-assignments/bulk", { token, body });
  const classTeacherResult = await post(tokens.official, { assignmentType: "class_teacher", academicYear: year, teacherId: ids.teacherOne, selections: [{ className: "Class 8", section: "A" }, { className: "Class 8", section: "B" }] });
  expectStatus(classTeacherResult, 201, "Bulk class-teacher assignment");
  assert.equal(classTeacherResult.data.assignments.length, 2, "Bulk class-teacher request must create both sections");

  const directOfficialAssignment = await post(tokens.unassignedOfficial, {
    assignmentType: "class_teacher", academicYear: year, teacherId: ids.teacherTwo,
    jnvId: otherJnvId, selections: [{ className: "Class 9", section: "A" }],
  });
  expectStatus(directOfficialAssignment, 201, "Registered official assigns without a separate admin assignment");
  assert.equal(directOfficialAssignment.data.assignments[0].jnvId, officialJnvId, "API must ignore client-supplied school IDs and use the authenticated official's JNV");
  const numericClassAssignment = await post(tokens.unassignedOfficial, { assignmentType: "class_teacher", academicYear: year, teacherId: ids.teacherTwo, selections: [{ className: "Class 12", section: "Unspecified" }] });
  expectStatus(numericClassAssignment, 201, "Assign teacher to a legacy numeric-only class profile");

  expectStatus(await post(tokens.official, { assignmentType: "class_teacher", academicYear: year, teacherId: ids.teacherTwo, selections: [{ className: "Class 8", section: "A" }] }), 409, "Duplicate primary class teacher");
  const subjectBody = { assignmentType: "subject_teacher", academicYear: year, teacherId: ids.teacherOne, subject: "Mathematics", selections: [{ className: "Class 8", section: "A", periodsPerWeek: 4 }] };
  const subjectResult = await post(tokens.official, subjectBody);
  expectStatus(subjectResult, 201, "Subject-teacher assignment");
  expectStatus(await post(tokens.official, subjectBody), 409, "Duplicate subject assignment");
  expectStatus(await post(tokens.official, { ...subjectBody, teacherId: ids.teacherTwo }), 409, "Multiple subject teachers disabled by default");

  const configResult = await api("PATCH", "/academic-teacher-assignments/settings", { token: tokens.official, body: { allowMultipleSubjectTeachers: true } });
  expectStatus(configResult, 200, "Enable multiple subject teachers setting");
  const secondSubject = await post(tokens.official, { ...subjectBody, teacherId: ids.teacherTwo });
  expectStatus(secondSubject, 201, "Multiple subject teachers when enabled");
  expectStatus(await post(tokens.official, { ...subjectBody, teacherId: ids.teacherTwo }), 409, "Duplicate same-teacher assignment with multiple teachers enabled");

  const teacherOneView = await api("GET", `/teacher/academic-assignments?academicYear=${year}`, { token: tokens.teacherOne });
  expectStatus(teacherOneView, 200, "Teacher own assignment list");
  assert.ok(teacherOneView.data.assignments.length === 3 && teacherOneView.data.assignments.every((row) => row.teacherId === ids.teacherOne), "Teachers must only receive their own rows");
  const teacherTwoView = await api("GET", `/teacher/academic-assignments?academicYear=${year}`, { token: tokens.teacherTwo });
  assert.ok(teacherTwoView.data.assignments.length === 3 && teacherTwoView.data.assignments.every((row) => row.teacherId === ids.teacherTwo), "Second teacher must see only their own active assignments");

  const newClassConflict = await post(tokens.official, { assignmentType: "class_teacher", academicYear: year, teacherId: ids.teacherTwo, selections: [{ className: "Class 10", section: "A" }, { className: "Class 8", section: "A" }] });
  expectStatus(newClassConflict, 409, "Bulk transaction conflict");
  const afterRollback = await api("GET", `/academic-teacher-assignments/overview?academicYear=${year}`, { token: tokens.official });
  assert.ok(!afterRollback.data.assignments.some((row) => row.className === "Class 10" && row.section === "A"), "A failed bulk request must roll back its earlier inserts");

  const edited = await api("PATCH", `/academic-teacher-assignments/${subjectResult.data.assignments[0].id}`, {
    token: tokens.official,
    body: { assignmentType: "subject_teacher", academicYear: year, teacherId: ids.teacherOne, subject: "Mathematics", selection: { className: "Class 8", section: "A", periodsPerWeek: 5 } },
  });
  expectStatus(edited, 200, "Edit assignment");
  assert.equal(edited.data.periodsPerWeek, 5, "Edit must update the configured periods workload");

  const removed = await api("DELETE", `/academic-teacher-assignments/${secondSubject.data.assignments[0].id}`, { token: tokens.official });
  expectStatus(removed, 200, "Remove assignment");
  const history = await api("GET", `/academic-teacher-assignments/overview?academicYear=${year}`, { token: tokens.official });
  assert.ok(history.data.history.some((row) => row.action === "created") && history.data.history.some((row) => row.action === "updated") && history.data.history.some((row) => row.action === "removed"), "Create, edit, and removal must all be auditable");

  for (const role of ["studentA", "alumni", "teacherOne"]) {
    expectStatus(await post(tokens[role], { ...subjectBody, teacherId: ids.teacherOne }), 403, `${role} cannot modify assignments`);
  }
  const crossJnv = await api("PATCH", `/academic-teacher-assignments/${classTeacherResult.data.assignments[0].id}`, {
    token: tokens.otherOfficial,
    body: { assignmentType: "class_teacher", academicYear: year, teacherId: ids.teacherOne, selection: { className: "Class 8", section: "A" } },
  });
  expectStatus(crossJnv, 404, "Official cannot edit another JNV assignment");
  const otherOverview = await api("GET", `/academic-teacher-assignments/overview?academicYear=${year}`, { token: tokens.otherOfficial });
  expectStatus(otherOverview, 200, "Other JNV scoped overview");
  assert.equal(otherOverview.data.assignments.length, 0, "Overview must not reveal another JNV's assignment rows");

  process.stdout.write("Academic assignment workflow checks passed: authorization, school scoping, class-teacher uniqueness, subject policy, bulk rollback, teacher self-view, edit, removal, and audit history.\n");
} finally {
  try { await pool.query("ROLLBACK"); } catch {}
  try { await cleanup(); } finally { await pool.end(); }
}
