import { Platform } from "react-native";

const browserTimers = new Map<string, ReturnType<typeof setInterval>>();

export async function scheduleCalendarReminder(title: string, scheduledAt: Date) {
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Choose a reminder time in the future.");
  }

  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") {
      throw new Error("This browser does not support notifications.");
    }
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Allow notifications in your browser to set a reminder.");

    const id = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = setInterval(() => {
      if (Date.now() < scheduledAt.getTime()) return;
      clearInterval(timer);
      browserTimers.delete(id);
      new Notification(title, { body: "Your calendar reminder is due." });
    }, 15_000);
    browserTimers.set(id, timer);
    return id;
  }

  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("calendar-reminders", {
      name: "Calendar reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#7C3AED",
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Allow notifications in your device settings to set a reminder.");

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: "Your calendar reminder is due.",
      sound: true,
      data: { type: "calendar-reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledAt,
      ...(Platform.OS === "android" ? { channelId: "calendar-reminders" } : {}),
    },
  });
}

export async function cancelCalendarReminder(notificationId: string) {
  if (notificationId.startsWith("web-")) {
    const timer = browserTimers.get(notificationId);
    if (timer) clearInterval(timer);
    browserTimers.delete(notificationId);
    return;
  }
  const Notifications = await import("expo-notifications");
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
