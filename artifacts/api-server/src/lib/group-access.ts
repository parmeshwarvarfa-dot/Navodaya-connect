export type GroupAccessUser = {
  role: string;
  jnvName: string | null;
  jnvState: string | null;
  class: string | null;
  passoutYear: string | null;
  house: string;
};

export type GroupAccessGroup = {
  name: string;
  subject: string;
  groupType?: string;
  class: string | null;
  jnvName: string | null;
  jnvState: string | null;
  jnvId?: string | null;
  clubId: string | null;
};

const normalized = (value: string | null | undefined) => value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
const grade = (value: string | null | undefined) => value?.match(/^\s*(?:class\s*)?(\d+)/i)?.[1] ?? "";

export function isEligibleForCommunityGroup(group: GroupAccessGroup, user: GroupAccessUser): boolean {
  if (group.groupType === "user_created" || group.clubId
    || (group.subject === "Staff Group" && group.groupType !== "school_managed")
    || (group.groupType !== "school_managed" && group.subject === "Private chat group")) return false;

  const hasSchool = Boolean(group.jnvName || group.jnvState);
  if (hasSchool) {
    if (!group.jnvName || !group.jnvState) return false;
    if (normalized(group.jnvName) !== normalized(user.jnvName) || normalized(group.jnvState) !== normalized(user.jnvState)) return false;
  } else {
    if (group.subject === "Alumni batch" || group.subject === "House community" || group.subject === "Class community" || group.subject === "School community") return false;
    if (group.subject !== "All Navodayans" && group.subject !== "Interest community") return false;
  }

  if (group.groupType === "school_managed") {
    if (!group.class) return true;
    return user.role === "student" && Boolean(grade(group.class) && grade(user.class) === grade(group.class));
  }

  if (group.name.trim().toLowerCase() === "jnv alumni network" || group.subject === "Alumni batch") {
    if (user.role !== "alumni") return false;
    const batch = group.class?.trim() || group.name.match(/\b(\d{4})\b/)?.[1] || "";
    return Boolean(batch && normalized(batch) === normalized(user.passoutYear));
  }

  if (group.subject === "House community") {
    const groupHouse = group.name.replace(/\s+house$/i, "");
    return ["student", "alumni"].includes(user.role) && Boolean(user.house) && normalized(groupHouse) === normalized(user.house);
  }

  const namedClass = group.name.match(/^class\s+([0-9]+[a-z]?)/i)?.[1];
  if (group.subject === "Class community" || group.class || namedClass) {
    const groupGrade = grade(group.class ?? namedClass);
    return user.role === "student" && Boolean(groupGrade && grade(user.class) === groupGrade);
  }

  return true;
}
