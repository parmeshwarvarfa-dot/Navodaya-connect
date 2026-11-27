import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import type { Event, PublicHolidayEntry } from "@/lib/api";
import { cancelCalendarReminder, scheduleCalendarReminder } from "@/lib/calendar-reminders";
import EventCard from "@/components/EventCard";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

type CalendarView = "month" | "week" | "agenda" | "year";
type CalendarReminder = { id: string; title: string; scheduledAt: string; notificationId: string };

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function addDays(date: Date, count: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -date.getDay());
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventDateKey(event: Event) {
  const date = new Date(event.date);
  return Number.isNaN(date.getTime()) ? "" : dateKey(date);
}

function holidayDateKey(holiday: PublicHolidayEntry) {
  return holiday.date;
}

function matchesHoliday(holiday: PublicHolidayEntry, query: string) {
  const searchable = `${holiday.title} ${holiday.description} ${holiday.calendar} ${holiday.date} ${formatDay(new Date(`${holiday.date}T12:00:00`))}`.toLocaleLowerCase();
  return searchable.includes(query.trim().toLocaleLowerCase());
}

function sameDay(left: Date, right: Date) {
  return dateKey(left) === dateKey(right);
}

function getRange(view: CalendarView, month: Date, selectedDate: Date, hasSearch: boolean) {
  if (hasSearch && view !== "agenda") {
    return {
      from: new Date(month.getFullYear(), 0, 1),
      to: new Date(month.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }
  if (view === "week") {
    const from = startOfWeek(selectedDate);
    return { from, to: endOfDay(addDays(from, 6)) };
  }
  if (view === "agenda") {
    const from = startOfDay(selectedDate);
    return { from, to: endOfDay(addDays(from, 365)) };
  }
  if (view === "year") {
    return {
      from: new Date(month.getFullYear(), 0, 1),
      to: new Date(month.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  return {
    from: gridStart,
    to: new Date(addDays(gridStart, 41).setHours(23, 59, 59, 999)),
  };
}

function formatDay(date: Date, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return date.toLocaleDateString("en-IN", options);
}

function formatEventDate(event: Event) {
  const date = new Date(event.date);
  return Number.isNaN(date.getTime())
    ? event.date
    : date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function matchesSearch(event: Event, query: string) {
  if (!query.trim()) return true;
  const date = new Date(event.date);
  const dateText = Number.isNaN(date.getTime())
    ? event.date
    : `${event.date} ${date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", weekday: "long" })} ${date.toLocaleDateString("en-IN")}`;
  const searchable = [event.title, event.description, event.location, event.organizer, event.jnvName, dateText, "navodaya connect events"]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return searchable.includes(query.trim().toLocaleLowerCase());
}

function sortedEvents(events: Event[]) {
  return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function EventList({
  events,
  registered,
  onRegister,
}: {
  events: Event[];
  registered: Set<string>;
  onRegister: (event: Event) => void;
}) {
  return (
    <>
      {sortedEvents(events).map((event, index) => (
        <EventCard
          key={event.id}
          event={event}
          index={index}
          registered={registered.has(event.id)}
          onRegister={() => onRegister(event)}
        />
      ))}
    </>
  );
}

export default function CalendarModal({
  visible,
  onClose,
  registered,
  onRegister,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  registered: Set<string>;
  onRegister: (event: Event) => void;
  userId?: string;
}) {
  const insets = useSafeAreaInsets();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeMonth, setActiveMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState<CalendarView>("month");
  const [events, setEvents] = useState<Event[]>([]);
  const [holidays, setHolidays] = useState<PublicHolidayEntry[]>([]);
  const [unavailableCalendars, setUnavailableCalendars] = useState<string[]>([]);
  const [holidayError, setHolidayError] = useState("");
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderError, setReminderError] = useState("");
  const [reminderNotice, setReminderNotice] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);
  const [showCommunityEvents, setShowCommunityEvents] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [preferenceNotice, setPreferenceNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const hasSearch = showSearch && Boolean(search.trim());
  const range = useMemo(() => getRange(view, activeMonth, selectedDate, hasSearch), [view, activeMonth, selectedDate, hasSearch]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    Promise.all([
      AsyncStorage.getItem(`calendar-view:${userId}`),
      AsyncStorage.getItem(`calendar-community-events:${userId}`),
    ])
      .then(([savedView, savedCommunityEvents]) => {
        if (!active) return;
        if (savedView === "month" || savedView === "week" || savedView === "agenda" || savedView === "year") setView(savedView);
        if (savedCommunityEvents === "true" || savedCommunityEvents === "false") setShowCommunityEvents(savedCommunityEvents === "true");
        setPreferenceNotice("");
      })
      .catch(() => {
        if (active) setPreferenceNotice("Calendar preferences could not be loaded. Default settings are being used.");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    api.events.list({ from: range.from.toISOString(), to: range.to.toISOString() })
      .then((result) => {
        if (active) setEvents(result);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load calendar events.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, range.from.getTime(), range.to.getTime(), retry]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setHolidaysLoading(true);
    setHolidayError("");
    api.calendar.holidays({ from: range.from.toISOString(), to: range.to.toISOString() })
      .then((result) => {
        if (!active) return;
        setHolidays(result.entries);
        setUnavailableCalendars(result.unavailableCalendars);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHolidays([]);
        setHolidayError(error instanceof Error ? error.message : "Could not load public holidays.");
        setUnavailableCalendars([]);
      })
      .finally(() => {
        if (active) setHolidaysLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, range.from.getTime(), range.to.getTime(), retry]);

  useEffect(() => {
    let active = true;
    const storageKey = `calendar-reminders:${userId ?? "guest"}`;
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (!active) return;
        if (!value) {
          setReminders([]);
          return;
        }
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) throw new Error("Saved reminders have an invalid format.");
        const valid = parsed.filter((item): item is CalendarReminder =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          typeof item.id === "string" &&
          "title" in item &&
          typeof item.title === "string" &&
          "scheduledAt" in item &&
          typeof item.scheduledAt === "string" &&
          !Number.isNaN(new Date(item.scheduledAt).getTime()) &&
          "notificationId" in item &&
          typeof item.notificationId === "string",
        );
        setReminders(valid);
      })
      .catch(() => {
        if (active) setReminderError("Saved reminders could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const visibleEvents = useMemo(
    () => events.filter((event) => showCommunityEvents && matchesSearch(event, search)),
    [events, search, showCommunityEvents],
  );
  const visibleHolidays = useMemo(
    () => holidays.filter((holiday) => matchesHoliday(holiday, search)),
    [holidays, search],
  );
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, Event[]>();
    for (const event of visibleEvents) {
      const key = eventDateKey(event);
      if (!key) continue;
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    return grouped;
  }, [visibleEvents]);
  const selectedEvents = eventsByDate.get(dateKey(selectedDate)) ?? [];
  const holidaysByDate = useMemo(() => {
    const grouped = new Map<string, PublicHolidayEntry[]>();
    for (const holiday of holidays) {
      const key = holidayDateKey(holiday);
      grouped.set(key, [...(grouped.get(key) ?? []), holiday]);
    }
    return grouped;
  }, [holidays]);
  const selectedHolidays = holidaysByDate.get(dateKey(selectedDate)) ?? [];
  const selectedReminders = reminders
    .filter((reminder) => dateKey(new Date(reminder.scheduledAt)) === dateKey(selectedDate))
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const remindersByDate = useMemo(() => {
    const grouped = new Map<string, CalendarReminder[]>();
    for (const reminder of reminders) {
      const key = dateKey(new Date(reminder.scheduledAt));
      grouped.set(key, [...(grouped.get(key) ?? []), reminder]);
    }
    return grouped;
  }, [reminders]);

  const saveReminders = async (nextReminders: CalendarReminder[]) => {
    await AsyncStorage.setItem(`calendar-reminders:${userId ?? "guest"}`, JSON.stringify(nextReminders));
    setReminders(nextReminders);
  };

  const addReminder = async () => {
    const title = reminderTitle.trim();
    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(reminderTime.trim());
    if (!title) {
      setReminderError("Enter a title for your reminder.");
      return;
    }
    if (!timeMatch) {
      setReminderError("Enter a valid time in 24-hour format, such as 09:30.");
      return;
    }
    if (reminders.some((reminder) =>
      dateKey(new Date(reminder.scheduledAt)) === dateKey(selectedDate) &&
      reminder.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
    )) {
      setReminderError("A reminder with this title already exists on this date.");
      return;
    }

    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    setSavingReminder(true);
    setReminderError("");
    setReminderNotice("");
    let notificationId: string | undefined;
    try {
      notificationId = await scheduleCalendarReminder(title, scheduledAt);
      const nextReminders = [...reminders, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title,
        scheduledAt: scheduledAt.toISOString(),
        notificationId,
      }];
      await saveReminders(nextReminders);
      setReminderTitle("");
      setReminderNotice(Platform.OS === "web"
        ? "Reminder saved. Keep this browser tab open until it is due."
        : "Reminder saved and notification scheduled.");
    } catch (error) {
      if (notificationId) {
        try {
          await cancelCalendarReminder(notificationId);
        } catch {
          setReminderError("The reminder could not be saved, and its notification could not be cancelled.");
          setSavingReminder(false);
          return;
        }
      }
      setReminderError(error instanceof Error ? error.message : "Could not save this reminder.");
    } finally {
      setSavingReminder(false);
    }
  };

  const removeReminder = async (reminder: CalendarReminder) => {
    setReminderError("");
    setReminderNotice("");
    try {
      await cancelCalendarReminder(reminder.notificationId);
      await saveReminders(reminders.filter((item) => item.id !== reminder.id));
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : "Could not remove this reminder.");
    }
  };

  const changeView = (nextView: CalendarView) => {
    setView(nextView);
    if (userId) {
      AsyncStorage.setItem(`calendar-view:${userId}`, nextView)
        .then(() => setPreferenceNotice(""))
        .catch(() => setPreferenceNotice("Calendar view preference could not be saved."));
    }
  };

  const changeCommunityEvents = () => {
    const nextValue = !showCommunityEvents;
    setShowCommunityEvents(nextValue);
    if (userId) {
      AsyncStorage.setItem(`calendar-community-events:${userId}`, String(nextValue))
        .then(() => setPreferenceNotice(""))
        .catch(() => setPreferenceNotice("Calendar filter preference could not be saved."));
    }
  };

  const moveMonth = (amount: number) => {
    const next = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + amount, 1);
    setActiveMonth(next);
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const selectToday = () => {
    setSelectedDate(today);
    setActiveMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const chooseDate = (date: Date) => {
    setSelectedDate(startOfDay(date));
    if (date.getMonth() !== activeMonth.getMonth() || date.getFullYear() !== activeMonth.getFullYear()) {
      setActiveMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  function renderSelectedDateDetails({
    includeEvents,
    includeHolidays,
    showEmptyState,
  }: {
    includeEvents: boolean;
    includeHolidays: boolean;
    showEmptyState: boolean;
  }) {
    const hasDateItems =
      (includeHolidays && selectedHolidays.length > 0) ||
      selectedReminders.length > 0 ||
      (includeEvents && selectedEvents.length > 0);
    return (
      <View style={styles.selectedAgenda}>
        <Text style={styles.agendaHeading}>
          {formatDay(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </Text>
        {includeHolidays ? selectedHolidays.map((holiday) => (
          <View key={holiday.id} style={styles.holidayCard}>
            <View style={styles.holidayIcon}><Ionicons name="sparkles-outline" size={18} color="#B45309" /></View>
            <View style={styles.holidayCopy}>
              <Text style={styles.holidayTitle}>{holiday.title}</Text>
              <Text style={styles.holidaySource}>{holiday.calendar} · Public calendar</Text>
              {holiday.description ? <Text style={styles.holidayDescription}>{holiday.description}</Text> : null}
            </View>
          </View>
        )) : null}
        {includeEvents && selectedEvents.length > 0
          ? <EventList events={selectedEvents} registered={registered} onRegister={onRegister} />
          : null}
        {showEmptyState && !hasDateItems ? renderEmptyState() : null}

        <View style={[styles.reminderPanel, !showEmptyState && !selectedReminders.length && styles.hiddenReminderPanel]}>
          <Text style={styles.reminderHeading}>Reminders</Text>
          <Text style={styles.reminderHint}>Set a title and local time for this date.</Text>
          <TextInput
            style={styles.reminderInput}
            value={reminderTitle}
            onChangeText={(value) => { setReminderTitle(value); setReminderError(""); }}
            placeholder="Reminder title"
            placeholderTextColor="#9690A3"
            maxLength={100}
            accessibilityLabel="Reminder title"
          />
          <View style={styles.reminderFormRow}>
            <TextInput
              style={[styles.reminderInput, styles.reminderTimeInput]}
              value={reminderTime}
              onChangeText={(value) => { setReminderTime(value); setReminderError(""); }}
              placeholder="HH:MM"
              placeholderTextColor="#9690A3"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              accessibilityLabel="Reminder time in 24-hour format"
            />
            <TouchableOpacity
              style={[styles.addReminderButton, savingReminder && styles.disabledButton]}
              onPress={addReminder}
              disabled={savingReminder}
              accessibilityRole="button"
              accessibilityLabel="Add reminder"
            >
              {savingReminder
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="add" size={17} color="#fff" /><Text style={styles.addReminderText}>Add reminder</Text></>}
            </TouchableOpacity>
          </View>
          {reminderError ? <Text style={styles.reminderError}>{reminderError}</Text> : null}
          {reminderNotice ? <Text style={styles.reminderNotice}>{reminderNotice}</Text> : null}
          {Platform.OS === "web" ? <Text style={styles.webReminderNotice}>Web reminders work while this browser tab remains open.</Text> : null}
          {selectedReminders.map((reminder) => (
            <View key={reminder.id} style={styles.reminderCard}>
              <View style={styles.reminderCopy}>
                <Text style={styles.reminderTitle}>{reminder.title}</Text>
                <Text style={styles.reminderWhen}>
                  {new Date(reminder.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => void removeReminder(reminder)} accessibilityRole="button" accessibilityLabel={`Delete reminder ${reminder.title}`}>
                <Ionicons name="trash-outline" size={18} color="#A34155" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const renderMonthGrid = () => {
    const first = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1);
    const gridStart = addDays(first, -first.getDay());
    const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
    return (
      <>
        <View style={styles.weekdayRow}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.weekday} accessibilityLabel={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {cells.map((date) => {
            const key = dateKey(date);
            const isSelected = sameDay(date, selectedDate);
            const inMonth = date.getMonth() === activeMonth.getMonth();
            const count = eventsByDate.get(key)?.length ?? 0;
            const hasHoliday = (holidaysByDate.get(key)?.length ?? 0) > 0;
            const hasReminder = (remindersByDate.get(key)?.length ?? 0) > 0;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.dayCell, isSelected && styles.selectedDayCell, sameDay(date, today) && !isSelected && styles.todayCell]}
                onPress={() => chooseDate(date)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDay(date)}, ${count} Navodaya Connect ${count === 1 ? "event" : "events"}${hasHoliday ? ", public holiday" : ""}${hasReminder ? ", reminder" : ""}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.dayText, !inMonth && styles.outsideMonthText, isSelected && styles.selectedDayText]}>
                  {date.getDate()}
                </Text>
                <View style={styles.indicatorRow}>
                  {count > 0 ? <View style={[styles.dayDot, isSelected && styles.selectedDot]} /> : null}
                  {hasHoliday ? <View style={[styles.dayDot, styles.holidayDot]} /> : null}
                  {hasReminder ? <View style={[styles.dayDot, styles.reminderDot]} /> : null}
                  {count === 0 && !hasHoliday && !hasReminder ? <View style={styles.dotPlaceholder} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  };

  const renderWeek = () => {
    const weekStart = startOfWeek(selectedDate);
    const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    return (
      <>
        <View style={styles.weekStrip}>
          {weekDays.map((date) => {
            const isSelected = sameDay(date, selectedDate);
            const count = eventsByDate.get(dateKey(date))?.length ?? 0;
            const hasHoliday = (holidaysByDate.get(dateKey(date))?.length ?? 0) > 0;
            return (
              <TouchableOpacity
                key={dateKey(date)}
                style={[styles.weekDay, isSelected && styles.selectedWeekDay]}
                onPress={() => chooseDate(date)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDay(date)}, ${count} events`}
              >
                <Text style={[styles.weekDayName, isSelected && styles.selectedDayText]}>
                  {date.toLocaleDateString("en-IN", { weekday: "short" })}
                </Text>
                <Text style={[styles.weekDayNumber, isSelected && styles.selectedDayText]}>{date.getDate()}</Text>
                <View style={styles.indicatorRow}>
                  {count > 0 ? <View style={[styles.dayDot, isSelected && styles.selectedDot]} /> : null}
                  {hasHoliday ? <View style={[styles.dayDot, styles.holidayDot]} /> : null}
                  {count === 0 && !hasHoliday ? <View style={styles.dotPlaceholder} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {weekDays.map((date) => {
          const dayEvents = eventsByDate.get(dateKey(date)) ?? [];
          const dayHolidays = holidaysByDate.get(dateKey(date)) ?? [];
          if (!dayEvents.length && !dayHolidays.length) return null;
          return (
            <View key={dateKey(date)} style={styles.agendaGroup}>
              <Text style={styles.agendaGroupTitle}>{formatDay(date)}</Text>
              {dayHolidays.map((holiday) => (
                <View key={holiday.id} style={styles.holidayCard}>
                  <View style={styles.holidayIcon}><Ionicons name="sparkles-outline" size={18} color="#B45309" /></View>
                  <View style={styles.holidayCopy}>
                    <Text style={styles.holidayTitle}>{holiday.title}</Text>
                    <Text style={styles.holidaySource}>{holiday.calendar} · Public calendar</Text>
                  </View>
                </View>
              ))}
              <EventList events={dayEvents} registered={registered} onRegister={onRegister} />
            </View>
          );
        })}
        {!weekDays.some((date) => (eventsByDate.get(dateKey(date))?.length ?? 0) > 0 || (holidaysByDate.get(dateKey(date))?.length ?? 0) > 0)
          ? renderEmptyState()
          : null}
      </>
    );
  };

  const renderAgenda = () => {
    const now = startOfDay(selectedDate);
    const tomorrow = addDays(now, 1);
    const weekEnd = addDays(now, 7);
    const groups = [
      { title: "Today", events: visibleEvents.filter((event) => eventDateKey(event) === dateKey(now)) },
      { title: "Tomorrow", events: visibleEvents.filter((event) => eventDateKey(event) === dateKey(tomorrow)) },
      {
        title: "Upcoming this week",
        events: visibleEvents.filter((event) => {
          const date = new Date(event.date);
          return date >= addDays(tomorrow, 1) && date < weekEnd;
        }),
      },
      {
        title: "Later",
        events: visibleEvents.filter((event) => new Date(event.date) >= weekEnd),
      },
    ].filter((group) => group.events.length > 0);
    const futureHolidays = holidays.filter((holiday) => holiday.date >= dateKey(now));
    return groups.length || futureHolidays.length ? (
      <>
        {groups.map((group) => (
        <View key={group.title} style={styles.agendaGroup}>
          <Text style={styles.agendaGroupTitle}>{group.title}</Text>
          <EventList events={group.events} registered={registered} onRegister={onRegister} />
        </View>
        ))}
        {futureHolidays.length ? (
          <View style={styles.agendaGroup}>
            <Text style={styles.agendaGroupTitle}>Public holidays</Text>
            {futureHolidays.map((holiday) => (
              <TouchableOpacity
                key={holiday.id}
                style={styles.holidayCard}
                onPress={() => chooseDate(new Date(`${holiday.date}T12:00:00`))}
                accessibilityRole="button"
                accessibilityLabel={`${holiday.title}, ${formatDay(new Date(`${holiday.date}T12:00:00`))}`}
              >
                <View style={styles.holidayIcon}><Ionicons name="sparkles-outline" size={18} color="#B45309" /></View>
                <View style={styles.holidayCopy}>
                  <Text style={styles.holidayTitle}>{holiday.title}</Text>
                  <Text style={styles.holidaySource}>{formatDay(new Date(`${holiday.date}T12:00:00`))} · {holiday.calendar}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </>
    ) : renderEmptyState("No upcoming events in this period.");
  };

  const renderYear = () => (
    <View style={styles.yearGrid}>
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const monthStart = new Date(activeMonth.getFullYear(), monthIndex, 1);
        const count = visibleEvents.filter((event) => {
          const date = new Date(event.date);
          return date.getFullYear() === activeMonth.getFullYear() && date.getMonth() === monthIndex;
        }).length;
        const holidayCount = holidays.filter((holiday) => Number(holiday.date.slice(0, 4)) === activeMonth.getFullYear() &&
          Number(holiday.date.slice(5, 7)) - 1 === monthIndex).length;
        return (
          <TouchableOpacity
            key={monthIndex}
            style={styles.yearMonth}
            onPress={() => {
              setActiveMonth(monthStart);
              setSelectedDate(monthStart);
              changeView("month");
            }}
            accessibilityRole="button"
            accessibilityLabel={`${monthStart.toLocaleDateString("en-IN", { month: "long" })}, ${count} events, ${holidayCount} public holidays`}
          >
            <Text style={styles.yearMonthName}>{monthStart.toLocaleDateString("en-IN", { month: "short" })}</Text>
            <Text style={styles.yearMonthCount}>
              {[count ? `${count} ${count === 1 ? "event" : "events"}` : "", holidayCount ? `${holidayCount} ${holidayCount === 1 ? "holiday" : "holidays"}` : ""].filter(Boolean).join(" · ") || "No events"}
            </Text>
            {count > 0 || holidayCount > 0 ? <View style={[styles.yearMonthDot, holidayCount > 0 && count === 0 && styles.holidayDot]} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  function renderEmptyState(message = "No events scheduled for this date.") {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}><Ionicons name="calendar-clear-outline" size={24} color="#7C3AED" /></View>
        <Text style={styles.emptyTitle}>{message}</Text>
        <Text style={styles.emptyDescription}>New community events will appear here once they are published.</Text>
        <TouchableOpacity style={styles.exploreButton} onPress={() => changeView("agenda")} accessibilityRole="button">
          <Text style={styles.exploreButtonText}>Explore upcoming events</Text>
          <Ionicons name="arrow-forward" size={15} color="#7C3AED" />
        </TouchableOpacity>
      </View>
    );
  }

  const monthTitle = activeMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 6);
  const headerTitle = view === "year"
    ? String(activeMonth.getFullYear())
    : view === "week"
      ? `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
      : view === "agenda"
        ? "Upcoming events"
        : monthTitle;
  const previousLabel = view === "week" ? "Previous week" : view === "agenda" ? "Earlier events" : view === "year" ? "Previous year" : "Previous month";
  const nextLabel = view === "week" ? "Next week" : view === "agenda" ? "Later events" : view === "year" ? "Next year" : "Next month";
  const navigate = (direction: -1 | 1) => {
    if (view === "agenda") {
      setSelectedDate((date) => addDays(date, direction * 30));
      return;
    }
    if (view === "week") {
      const nextDate = addDays(selectedDate, direction * 7);
      setSelectedDate(nextDate);
      setActiveMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      return;
    }
    if (view === "year") {
      const nextYear = new Date(activeMonth.getFullYear() + direction, activeMonth.getMonth(), 1);
      setActiveMonth(nextYear);
      setSelectedDate(nextYear);
      return;
    }
    moveMonth(direction);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerIcon}><Ionicons name="calendar" size={20} color="#7C3AED" /></View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Smart Calendar</Text>
              <Text style={styles.subtitle}>Real community events</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close calendar">
              <Ionicons name="close" size={22} color="#475569" />
            </TouchableOpacity>
          </View>

          <View style={styles.monthNavigation}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigate(-1)}
              accessibilityRole="button"
              accessibilityLabel={previousLabel}
            >
              <Ionicons name="chevron-back" size={19} color="#475569" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{headerTitle}</Text>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigate(1)}
              accessibilityRole="button"
              accessibilityLabel={nextLabel}
            >
              <Ionicons name="chevron-forward" size={19} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.todayButton} onPress={selectToday} accessibilityRole="button">
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.viewSelector}>
            {(["month", "week", "agenda", "year"] as CalendarView[]).map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => changeView(item)}
                style={[styles.viewOption, view === item && styles.activeViewOption]}
                accessibilityRole="button"
                accessibilityState={{ selected: view === item }}
              >
                <Text style={[styles.viewOptionText, view === item && styles.activeViewOptionText]}>
                  {item[0].toUpperCase() + item.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toolsRow}>
            <TouchableOpacity
              style={[styles.toolButton, showSearch && styles.activeToolButton]}
              onPress={() => { setShowSearch((current) => !current); setSearch(""); }}
              accessibilityRole="button"
              accessibilityLabel="Search calendar"
            >
              <Ionicons name="search-outline" size={17} color="#6D28D9" />
              <Text style={styles.toolButtonText}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolButton, showFilters && styles.activeToolButton]}
              onPress={() => setShowFilters((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel="Calendar filters"
            >
              <Ionicons name="options-outline" size={17} color="#6D28D9" />
              <Text style={styles.toolButtonText}>Filters</Text>
            </TouchableOpacity>
          </View>

          {showSearch ? (
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={17} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search events, holidays, dates, places..."
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                accessibilityLabel="Search calendar events"
              />
              {search ? <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color="#94A3B8" /></TouchableOpacity> : null}
            </View>
          ) : null}

          {showFilters ? (
            <View style={styles.filterPanel}>
              <Text style={styles.filterHeading}>Show on calendar</Text>
              <TouchableOpacity style={styles.filterOption} onPress={changeCommunityEvents} accessibilityRole="checkbox" accessibilityState={{ checked: showCommunityEvents }}>
                <Ionicons name={showCommunityEvents ? "checkbox" : "square-outline"} size={20} color={showCommunityEvents ? "#7C3AED" : "#94A3B8"} />
                <View style={styles.filterOptionCopy}>
                  <Text style={styles.filterOptionText}>Navodaya Connect events</Text>
                  <Text style={styles.filterOptionSub}>Published event listings</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.sourceNotice}>Public dates come from Google’s India and United States holiday calendars. Dates can vary by region; school vacations and JNV academic calendars are not included.</Text>
            </View>
          ) : null}

          <View style={styles.legend}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>Navodaya Connect events</Text>
            <View style={styles.holidayLegendDot} />
            <Text style={styles.legendText}>Public holiday</Text>
          </View>
          {holidaysLoading ? <Text style={styles.preferenceNotice}>Loading public holidays…</Text> : null}
          {holidayError ? (
            <TouchableOpacity onPress={() => setRetry((value) => value + 1)} accessibilityRole="button">
              <Text style={styles.holidayError}>{holidayError} Community events are still available. Tap to retry.</Text>
            </TouchableOpacity>
          ) : null}
          {unavailableCalendars.length ? (
            <TouchableOpacity onPress={() => setRetry((value) => value + 1)} accessibilityRole="button">
              <Text style={styles.holidayError}>Could not load: {unavailableCalendars.join(", ")} holiday calendar. Tap to retry.</Text>
            </TouchableOpacity>
          ) : null}
          {preferenceNotice ? <Text style={styles.preferenceNotice}>{preferenceNotice}</Text> : null}

          {loadError ? (
            <TouchableOpacity style={styles.errorCard} onPress={() => setRetry((value) => value + 1)} accessibilityRole="button">
              <Ionicons name="refresh-outline" size={18} color="#B42318" />
              <Text style={styles.errorText}>{loadError} Tap to retry.</Text>
            </TouchableOpacity>
          ) : null}

          {loading ? (
            <View style={styles.loading}><ActivityIndicator color="#7C3AED" /><Text style={styles.loadingText}>Loading events…</Text></View>
          ) : (
            <ScrollView
              style={styles.calendarScroll}
              contentContainerStyle={styles.calendarScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {hasSearch ? (
                <View style={styles.searchResults}>
                  <Text style={styles.agendaHeading}>Search results</Text>
                  {visibleHolidays.map((holiday) => (
                    <TouchableOpacity
                      key={holiday.id}
                      style={styles.holidayCard}
                      onPress={() => { chooseDate(new Date(`${holiday.date}T12:00:00`)); setSearch(""); }}
                      accessibilityRole="button"
                    >
                      <View style={styles.holidayIcon}><Ionicons name="sparkles-outline" size={18} color="#B45309" /></View>
                      <View style={styles.holidayCopy}>
                        <Text style={styles.holidayTitle}>{holiday.title}</Text>
                        <Text style={styles.holidaySource}>{formatDay(new Date(`${holiday.date}T12:00:00`))} · {holiday.calendar}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {visibleEvents.length
                    ? <EventList events={visibleEvents} registered={registered} onRegister={onRegister} />
                    : null}
                  {!visibleEvents.length && !visibleHolidays.length ? renderEmptyState("No matching events or holidays found.") : null}
                </View>
              ) : (
                <>
                  {view === "month" ? renderMonthGrid() : null}
                  {view === "week" ? renderWeek() : null}
                  {view === "year" ? renderYear() : null}
                  {view === "agenda" ? renderAgenda() : null}
                  {renderSelectedDateDetails({
                    includeEvents: view === "month",
                    includeHolidays: view === "month",
                    showEmptyState: view === "month",
                  })}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  content: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEE9FA" },
  headerIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F3EEFF", alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  title: { color: "#1E1B4B", fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { color: "#7C8494", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  monthNavigation: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  navButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E9E5F2" },
  monthTitle: { flex: 1, textAlign: "center", color: "#201A3D", fontSize: 16, fontFamily: "Inter_700Bold" },
  todayButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: "#F0EAFE" },
  todayButtonText: { color: "#6D28D9", fontSize: 12, fontFamily: "Inter_700Bold" },
  viewSelector: { flexDirection: "row", marginHorizontal: 16, padding: 4, borderRadius: 14, backgroundColor: "#EEEAF6" },
  viewOption: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 10 },
  activeViewOption: { backgroundColor: "#fff", shadowColor: "#312E81", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 1 },
  viewOptionText: { color: "#77718A", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  activeViewOptionText: { color: "#6D28D9" },
  toolsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  toolButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEE9FA" },
  activeToolButton: { backgroundColor: "#F4F0FF", borderColor: "#D8C8FF" },
  toolButtonText: { color: "#5B4B7A", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E7E1F2" },
  searchInput: { flex: 1, color: "#25213A", fontFamily: "Inter_400Regular", fontSize: 13, paddingVertical: 0 },
  filterPanel: { marginHorizontal: 16, marginBottom: 8, padding: 13, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEE9FA" },
  filterHeading: { color: "#29243D", fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 8 },
  filterOption: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 6 },
  filterOptionCopy: { flex: 1 },
  filterOptionText: { color: "#39334D", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  filterOptionSub: { color: "#8A8498", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  sourceNotice: { color: "#706B7E", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 7 },
  legend: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 18, paddingVertical: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#7C3AED" },
  holidayLegendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D97706", marginLeft: 8 },
  legendText: { color: "#5D526E", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  legendHint: { color: "#9B95A8", fontSize: 10, fontFamily: "Inter_400Regular" },
  preferenceNotice: { color: "#8A4B08", fontSize: 11, fontFamily: "Inter_500Medium", paddingHorizontal: 18, paddingBottom: 5 },
  holidayError: { color: "#9A3412", fontSize: 11, lineHeight: 16, fontFamily: "Inter_500Medium", paddingHorizontal: 18, paddingBottom: 5 },
  errorCard: { flexDirection: "row", gap: 8, alignItems: "center", marginHorizontal: 16, padding: 12, borderRadius: 12, backgroundColor: "#FEF3F2" },
  errorText: { flex: 1, color: "#B42318", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  loading: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#77718A", fontSize: 13, fontFamily: "Inter_500Medium" },
  calendarScroll: { flex: 1 },
  calendarScrollContent: { paddingHorizontal: 16, paddingBottom: 35 },
  weekdayRow: { flexDirection: "row", marginTop: 5, marginBottom: 3 },
  weekday: { width: `${100 / 7}%`, textAlign: "center", paddingVertical: 8, color: "#8B8498", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#fff", borderRadius: 16, paddingVertical: 5, borderWidth: 1, borderColor: "#EEE9FA" },
  dayCell: { width: `${100 / 7}%`, height: 47, alignItems: "center", justifyContent: "center", gap: 3 },
  selectedDayCell: { backgroundColor: "#7C3AED", borderRadius: 13 },
  todayCell: { borderWidth: 1, borderColor: "#C4B5FD", borderRadius: 13 },
  dayText: { color: "#39334D", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  outsideMonthText: { color: "#C1BDCA", fontFamily: "Inter_400Regular" },
  selectedDayText: { color: "#fff" },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#7C3AED" },
  selectedDot: { backgroundColor: "#fff" },
  holidayDot: { backgroundColor: "#D97706" },
  reminderDot: { backgroundColor: "#0891B2" },
  indicatorRow: { minHeight: 5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  dotPlaceholder: { width: 5, height: 5 },
  selectedAgenda: { marginTop: 18 },
  agendaHeading: { color: "#211D38", fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 11 },
  emptyState: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 24, marginTop: 2, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#F0ECF6" },
  emptyIcon: { width: 45, height: 45, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#F3EEFF", marginBottom: 10 },
  emptyTitle: { color: "#38314D", textAlign: "center", fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyDescription: { color: "#8B8498", textAlign: "center", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 5 },
  exploreButton: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, marginTop: 8 },
  exploreButtonText: { color: "#6D28D9", fontSize: 12, fontFamily: "Inter_700Bold" },
  weekStrip: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 3, backgroundColor: "#fff", borderRadius: 15, borderWidth: 1, borderColor: "#EEE9FA" },
  weekDay: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 11, gap: 4 },
  selectedWeekDay: { backgroundColor: "#7C3AED" },
  weekDayName: { color: "#8B8498", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  weekDayNumber: { color: "#39334D", fontSize: 13, fontFamily: "Inter_700Bold" },
  agendaGroup: { marginTop: 16 },
  agendaGroupTitle: { color: "#5B526B", fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 9 },
  holidayCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8, padding: 12, borderRadius: 13, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A" },
  holidayIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#FEF3C7" },
  holidayCopy: { flex: 1 },
  holidayTitle: { color: "#713F12", fontSize: 13, fontFamily: "Inter_700Bold" },
  holidaySource: { color: "#9A6700", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 },
  holidayDescription: { color: "#7C5A21", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 5 },
  reminderPanel: { marginTop: 14, padding: 14, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEE9FA" },
  hiddenReminderPanel: { display: "none" },
  reminderHeading: { color: "#29243D", fontSize: 14, fontFamily: "Inter_700Bold" },
  reminderHint: { color: "#8B8498", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3, marginBottom: 10 },
  reminderInput: { height: 42, borderRadius: 11, paddingHorizontal: 12, color: "#25213A", backgroundColor: "#FAF9FC", borderWidth: 1, borderColor: "#E7E1F2", fontFamily: "Inter_400Regular", fontSize: 13 },
  reminderFormRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  reminderTimeInput: { width: 100 },
  addReminderButton: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 11, backgroundColor: "#6D28D9" },
  disabledButton: { opacity: 0.6 },
  addReminderText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  reminderError: { color: "#B42318", fontSize: 11, lineHeight: 16, fontFamily: "Inter_500Medium", marginTop: 7 },
  reminderNotice: { color: "#26734D", fontSize: 11, lineHeight: 16, fontFamily: "Inter_500Medium", marginTop: 7 },
  webReminderNotice: { color: "#77694A", fontSize: 10, lineHeight: 14, fontFamily: "Inter_400Regular", marginTop: 7 },
  reminderCard: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F0ECF6" },
  reminderCopy: { flex: 1 },
  reminderTitle: { color: "#39334D", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  reminderWhen: { color: "#8B8498", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  yearGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 7 },
  yearMonth: { width: "31%", minHeight: 86, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEE9FA", padding: 12, justifyContent: "center" },
  yearMonthName: { color: "#29243D", fontSize: 15, fontFamily: "Inter_700Bold" },
  yearMonthCount: { color: "#8B8498", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 5 },
  yearMonthDot: { position: "absolute", right: 12, top: 14, width: 7, height: 7, borderRadius: 4, backgroundColor: "#7C3AED" },
  searchResults: { marginTop: 18 },
});
