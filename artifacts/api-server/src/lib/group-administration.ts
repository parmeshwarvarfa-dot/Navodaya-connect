import type { GroupType } from "@workspace/db/schema";

const GROUP_ADMIN_MANAGED_TYPES = new Set<GroupType>(["user_created", "school_managed"]);
const GROUP_MESSAGE_ADMIN_TYPES = new Set<GroupType>([
  "user_created", "school_managed", "staff_managed", "club_managed",
]);

export function supportsGroupAdminRoles(groupType: GroupType): boolean {
  return GROUP_ADMIN_MANAGED_TYPES.has(groupType);
}

export function supportsAdminOnlyMessages(groupType: GroupType): boolean {
  return GROUP_MESSAGE_ADMIN_TYPES.has(groupType);
}

export function initialGroupMemberRole(groupType: GroupType, userId: string, creatorId: string): "admin" | "member" {
  return userId === creatorId && supportsGroupAdminRoles(groupType)
    ? "admin"
    : "member";
}

export function mayChangeGroupMemberRole(groupType: GroupType, actorId: string, targetId: string, actorRole: string | null | undefined): boolean {
  return actorId !== targetId && actorRole === "admin" && supportsGroupAdminRoles(groupType);
}
