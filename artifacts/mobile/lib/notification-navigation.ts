export type NotificationRoute = {
  pathname: string;
  params?: Record<string, string>;
};

export type NotificationLink = {
  type: string;
  actorId?: string | null;
  actorName?: string | null;
  entityId?: string | null;
};

const inbox = (tab?: string, conversationId?: string): NotificationRoute => ({
  pathname: "/(screens)/social-inbox",
  params: {
    ...(tab ? { tab } : {}),
    ...(conversationId ? { conversationId } : {}),
  },
});

export function getNotificationRoute(notification: NotificationLink): NotificationRoute {
  switch (notification.type) {
    case "direct_message":
    case "direct_message_accepted": {
      if (!notification.entityId || !notification.actorId) return inbox("messages");
      return {
        pathname: "/(screens)/direct-chat",
        params: {
          id: notification.entityId,
          name: notification.actorName || "Conversation",
          peerId: notification.actorId,
          photoURL: "",
        },
      };
    }
    case "direct_message_request":
      return inbox("message_requests");
    case "follow_request":
      return inbox("follow_requests");
    case "follow":
    case "follow_accepted":
      return notification.actorId
        ? { pathname: "/(screens)/user-profile", params: { userId: notification.actorId } }
        : inbox("activity");
    case "memory_like":
    case "memory_comment":
      return { pathname: "/(tabs)/memories" };
    case "group_message":
    case "group_mention":
    case "group_reply":
    case "group_invitation":
    case "group_announcement":
      return notification.entityId
        ? { pathname: "/(screens)/group-chat", params: { id: notification.entityId, name: "Group chat" } }
        : { pathname: "/(tabs)/groups" };
    case "event":
    case "event_reminder":
    case "event_invitation":
    case "event_updated":
    case "event_cancelled":
      return { pathname: "/(tabs)/events" };
    case "announcement":
    case "news":
      return { pathname: "/(screens)/news" };
    case "yearbook_review":
      return { pathname: "/(screens)/yearbook" };
    case "problem":
    case "problem_update":
      return notification.entityId
        ? { pathname: "/(screens)/problem-detail", params: { id: notification.entityId } }
        : { pathname: "/(screens)/view-problems" };
    case "report_update":
      return { pathname: "/(screens)/view-problems" };
    case "verification_approved":
    case "verification_reviewed":
    case "verification_decision":
    case "verification_decision_needed":
    case "verification_resubmitted":
    case "verification_admin_appointed":
    case "verification_admin_removed":
      return { pathname: "/(screens)/verification-center" };
    case "alumni_peer_request":
      return { pathname: "/(screens)/alumni-peer-verification" };
    case "alumni_peer_confirmed":
    case "alumni_peer_declined":
    case "alumni_moderation_update":
      return { pathname: "/(screens)/alumni-peer-verification" };
    case "alumni_report_received":
    case "alumni_appeal_received":
      return { pathname: "/(screens)/alumni-moderation" };
    case "credential_suspended":
    case "credential_reactivated":
      return { pathname: "/(screens)/digital-id" };
    case "alumni_batch_transition":
      return { pathname: "/(tabs)/profile" };
    case "academic_assignment":
      return { pathname: "/(screens)/teacher-classes" };
    default:
      return inbox("activity");
  }
}
