import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface AttendanceStudentEntry {
  studentId: string;
  studentName: string;
  status: "present" | "absent" | "leave";
  remarks?: string;
}

export interface AttendanceRecord {
  id: string;
  assignmentId: string;
  className: string;
  section: string;
  date: string; // YYYY-MM-DD
  markedById: string;
  markedByName: string;
  recordedAt: string;
  students: AttendanceStudentEntry[];
}

export interface AssessmentScoreEntry {
  studentId: string;
  studentName: string;
  marksObtained: number;
  remarks?: string;
  grade?: string;
}

export interface AssessmentRecord {
  id: string;
  assignmentId: string;
  className: string;
  section: string;
  subject: string;
  title: string;
  date: string; // YYYY-MM-DD
  totalMarks: number;
  weightage?: number;
  createdById: string;
  createdByName: string;
  published: boolean;
  createdAt: string;
  scores: AssessmentScoreEntry[];
}

export interface TimetableSlot {
  period: number;
  time: string;
  subject: string;
  teacherName: string;
  room?: string;
}

export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

export interface ClassTimetable {
  assignmentId: string;
  className: string;
  section: string;
  schedule: Record<DayOfWeek, TimetableSlot[]>;
}

interface AcademicStoreData {
  attendance: AttendanceRecord[];
  assessments: AssessmentRecord[];
  timetables: Record<string, ClassTimetable>;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "academic-records.json");

function ensureStore(): AcademicStoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: AcademicStoreData = { attendance: [], assessments: [], timetables: {} };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    const fallback: AcademicStoreData = { attendance: [], assessments: [], timetables: {} };
    return fallback;
  }
}

function saveStore(data: AcademicStoreData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist academic store:", err);
  }
}

export function calculateGrade(marks: number, total: number): string {
  if (total <= 0) return "—";
  const pct = (marks / total) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "E";
}

export const academicStore = {
  getAttendanceForClass(assignmentId: string, date?: string): AttendanceRecord[] {
    const data = ensureStore();
    return data.attendance
      .filter((r) => r.assignmentId === assignmentId && (!date || r.date === date))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  recordAttendance(record: Omit<AttendanceRecord, "id" | "recordedAt">): AttendanceRecord {
    const data = ensureStore();
    const existingIndex = data.attendance.findIndex(
      (r) => r.assignmentId === record.assignmentId && r.date === record.date
    );
    const newEntry: AttendanceRecord = {
      ...record,
      id: existingIndex >= 0 ? data.attendance[existingIndex].id : randomUUID(),
      recordedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      data.attendance[existingIndex] = newEntry;
    } else {
      data.attendance.unshift(newEntry);
    }
    saveStore(data);
    return newEntry;
  },

  getAssessmentsForClass(assignmentId: string): AssessmentRecord[] {
    const data = ensureStore();
    return data.assessments
      .filter((a) => a.assignmentId === assignmentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createAssessment(record: Omit<AssessmentRecord, "id" | "createdAt">): AssessmentRecord {
    const data = ensureStore();
    const scoredWithGrades = record.scores.map((s) => ({
      ...s,
      grade: calculateGrade(s.marksObtained, record.totalMarks),
    }));
    const newAssessment: AssessmentRecord = {
      ...record,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      scores: scoredWithGrades,
    };
    data.assessments.unshift(newAssessment);
    saveStore(data);
    return newAssessment;
  },

  updateAssessment(id: string, updates: Partial<AssessmentRecord>): AssessmentRecord | null {
    const data = ensureStore();
    const index = data.assessments.findIndex((a) => a.id === id);
    if (index < 0) return null;
    const existing = data.assessments[index];
    const totalMarks = updates.totalMarks ?? existing.totalMarks;
    const scores = (updates.scores ?? existing.scores).map((s) => ({
      ...s,
      grade: calculateGrade(s.marksObtained, totalMarks),
    }));

    const updated: AssessmentRecord = {
      ...existing,
      ...updates,
      scores,
    };
    data.assessments[index] = updated;
    saveStore(data);
    return updated;
  },

  getTimetable(assignmentId: string, className: string, section: string, defaultSubject: string, defaultTeacher: string): ClassTimetable {
    const data = ensureStore();
    if (data.timetables[assignmentId]) {
      return data.timetables[assignmentId];
    }

    const defaultSlots: TimetableSlot[] = [
      { period: 1, time: "09:15 - 10:00", subject: defaultSubject || "Mathematics", teacherName: defaultTeacher || "Teacher", room: "Room 101" },
      { period: 2, time: "10:00 - 10:45", subject: "Physics", teacherName: "Faculty", room: "Physics Lab" },
      { period: 3, time: "10:45 - 11:30", subject: "Chemistry", teacherName: "Faculty", room: "Chemistry Lab" },
      { period: 4, time: "11:50 - 12:35", subject: defaultSubject || "Mathematics", teacherName: defaultTeacher || "Teacher", room: "Room 101" },
      { period: 5, time: "12:35 - 13:20", subject: "English", teacherName: "Faculty", room: "Room 101" },
      { period: 6, time: "14:30 - 15:15", subject: "Biology / Comp Sci", teacherName: "Faculty", room: "Computer Lab" },
      { period: 7, time: "15:15 - 16:00", subject: "Physical Education", teacherName: "PET", room: "Ground" },
      { period: 8, time: "16:00 - 16:45", subject: "Self-Study & Remedial", teacherName: defaultTeacher || "Faculty", room: "Library" },
    ];

    const generated: ClassTimetable = {
      assignmentId,
      className,
      section,
      schedule: {
        Monday: defaultSlots,
        Tuesday: defaultSlots,
        Wednesday: defaultSlots,
        Thursday: defaultSlots,
        Friday: defaultSlots,
        Saturday: defaultSlots.slice(0, 5),
      },
    };

    data.timetables[assignmentId] = generated;
    saveStore(data);
    return generated;
  },

  updateTimetable(assignmentId: string, schedule: Record<DayOfWeek, TimetableSlot[]>): ClassTimetable {
    const data = ensureStore();
    const existing = data.timetables[assignmentId] || {
      assignmentId,
      className: "Class",
      section: "Unspecified",
      schedule,
    };
    existing.schedule = schedule;
    data.timetables[assignmentId] = existing;
    saveStore(data);
    return existing;
  },
};

