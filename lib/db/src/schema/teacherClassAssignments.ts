import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const teacherClassAssignmentsTable = pgTable("teacher_class_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  jnvId: text("jnv_id").notNull(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  teacherId: uuid("teacher_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  teacherName: text("teacher_name").notNull(),
  className: text("class_name").notNull(),
  subject: text("subject").notNull(),
  section: text("section").notNull().default("Unspecified"),
  assignmentType: text("assignment_type").notNull().default("subject_teacher"),
  academicYear: text("academic_year").notNull(),
  periodsPerWeek: integer("periods_per_week"),
  assignedById: uuid("assigned_by_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  modifiedById: uuid("modified_by_id").references(() => usersTable.id, { onDelete: "restrict" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
  revokedById: uuid("revoked_by_id").references(() => usersTable.id, { onDelete: "restrict" }),
}, (table) => [
  index("teacher_class_assignments_jnv_teacher_idx").on(table.jnvId, table.teacherId, table.active),
  index("teacher_class_assignments_jnv_class_idx").on(table.jnvId, table.academicYear, table.className, table.section, table.active),
  check("teacher_class_assignments_type_check", sql`${table.assignmentType} IN ('class_teacher', 'subject_teacher')`),
  check("teacher_class_assignments_periods_check", sql`${table.periodsPerWeek} IS NULL OR ${table.periodsPerWeek} BETWEEN 1 AND 60`),
  check("teacher_class_assignments_academic_year_check", sql`${table.academicYear} ~ '^20[0-9]{2}-20[0-9]{2}$'`),
  uniqueIndex("teacher_class_assignments_primary_class_teacher_uidx")
    .on(table.jnvId, table.academicYear, table.className, table.section)
    .where(sql`${table.active} = true AND ${table.assignmentType} = 'class_teacher'`),
  uniqueIndex("teacher_class_assignments_subject_teacher_uidx")
    .on(table.jnvId, table.academicYear, table.className, table.section, table.subject, table.teacherId)
    .where(sql`${table.active} = true AND ${table.assignmentType} = 'subject_teacher'`),
]);

export const jnvAcademicSettingsTable = pgTable("jnv_academic_settings", {
  jnvId: text("jnv_id").primaryKey(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  allowMultipleSubjectTeachers: boolean("allow_multiple_subject_teachers").notNull().default(false),
  updatedById: uuid("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const teacherAssignmentAuditTable = pgTable("teacher_assignment_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id").references(() => teacherClassAssignmentsTable.id, { onDelete: "set null" }),
  jnvId: text("jnv_id").notNull(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  academicYear: text("academic_year").notNull(),
  previousData: jsonb("previous_data").$type<Record<string, unknown> | null>(),
  newData: jsonb("new_data").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  check("teacher_assignment_audit_action_check", sql`${table.action} IN ('created', 'updated', 'removed')`),
  index("teacher_assignment_audit_school_year_idx").on(table.jnvId, table.academicYear, table.createdAt),
  index("teacher_assignment_audit_assignment_idx").on(table.assignmentId, table.createdAt),
]);

export type TeacherClassAssignment = typeof teacherClassAssignmentsTable.$inferSelect;
export type TeacherAssignmentAudit = typeof teacherAssignmentAuditTable.$inferSelect;
