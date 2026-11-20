/** S42 — Notifications. One grouped list per section (D7); switches as row accessories. */
import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { useToastStore } from '@/app-shell';
import { S42_COPY } from '@/features/settings/copy';
import { formatTimeOfDay } from '@/features/browse/format';
import { NotificationSample } from '@/features/notifications/NotificationSample';
import { useSettings, useTasks, useUpdateSettings } from '@/queries';
import { initNotificationsBridge } from '@/services/notifications';
import { initWidgetsBridge } from '@/services/widgets';
import { EmptyLine, ListGroup, ListRow, Screen, Select, Skeleton, Switch } from '@/ui';
import type { NotificationPrefs } from '@/types';

const DIGEST_TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
];

function shortDate(date: string): string {
  const [y = 2000, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function S42NotificationsSettings() {
  const router = useRouter();
  const settingsQuery = useSettings();
  const tasksQuery = useTasks();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    initNotificationsBridge();
    initWidgetsBridge();
  }, []);

  function handleBack() {
    router.push('/settings' as Href);
  }

  async function patchPrefs(patch: Partial<NotificationPrefs>) {
    // Send only the key that changed. The repository merges it into the saved row, so a toggle
    // pressed before the screen has refetched cannot undo an earlier one by sending a stale copy.
    const result = await updateSettings.mutateAsync({ notifications: patch as NotificationPrefs });
    if (!result.ok) showToast(S42_COPY.errorToast, 'warning');
  }

  const prefs = settingsQuery.data?.notifications;

  if (settingsQuery.isLoading || !prefs) {
    return (
      <Screen title={S42_COPY.title} onBack={handleBack}>
        <Skeleton height={64} radius={16} />
        <Skeleton height={220} radius={16} />
        <Skeleton height={120} radius={16} />
      </Screen>
    );
  }

  const allSubsOff =
    !prefs.routineDue && !prefs.eventStarting && !prefs.courseDose && !prefs.courseEndingSoon && !prefs.gentleReentry && !prefs.milestoneReached && !prefs.dailyDigest;

  // Each sample uses one of the person's own tasks, so the picture is of their reminder.
  const tasks = (tasksQuery.data ?? []).filter((task) => !task.deletedAt);
  const routines = tasks.filter((task) => task.type === 'routine' && !task.isAsNeeded);
  const routine = routines.find((task) => task.timeOfDay) ?? routines[0];
  const event = tasks.find((task) => task.type === 'event');
  const course = tasks.find((task) => task.type === 'course');
  const routineName = routine?.name ?? 'Morning workout';
  const eventName = event?.name ?? 'Dentist';
  const courseName = course?.name ?? 'Antibiotics';
  const samples: Record<string, { title: string; body: string; when: string }> = {
    routineDue: { title: `Time for your ${routineName}`, body: 'Too tired? The fallback still counts.', when: routine?.timeOfDay ? formatTimeOfDay(routine.timeOfDay) : 'now' },
    eventStarting: { title: `${eventName} is coming up`, body: 'Starting today.', when: event?.timeOfDay ? formatTimeOfDay(event.timeOfDay) : 'now' },
    courseDose: { title: `${courseName}: today's dose`, body: 'Log it when you take it.', when: 'now' },
    courseEndingSoon: { title: `${courseName} is ending soon`, body: `Runs through ${course?.endDate ? shortDate(course.endDate) : 'Friday'}.`, when: 'now' },
    gentleReentry: { title: 'A quiet invitation back', body: 'Yesterday slipped by. Today is a fresh one. Even the fallback counts.', when: 'now' },
    milestoneReached: { title: 'Milestone reached', body: "You've hit a new level or badge. Nice work.", when: 'now' },
    dailyDigest: { title: 'Your day, at a glance', body: "Check in on today's habits.", when: formatTimeOfDay(prefs.dailyDigestTime) },
  };

  const toggle = (label: string, key: keyof NotificationPrefs) => {
    const sample = samples[key];
    return (
      <View key={key}>
        <ListRow
          label={label}
          right={<Switch value={!!prefs[key]} onValueChange={(v) => void patchPrefs({ [key]: v } as Partial<NotificationPrefs>)} accessibilityLabel={`${label}, ${prefs[key] ? 'on' : 'off'}`} />}
        />
        {sample ? <NotificationSample title={sample.title} body={sample.body} when={sample.when} off={!prefs[key]} /> : null}
      </View>
    );
  };

  return (
    <Screen title={S42_COPY.title} onBack={handleBack}>
      <ListGroup footer={prefs.master ? S42_COPY.masterOnSubcopy : S42_COPY.emptySubcopy}>
        <ListRow
          label="Allow notifications"
          right={<Switch value={prefs.master} onValueChange={(v) => void patchPrefs({ master: v })} accessibilityLabel={`Allow notifications, ${prefs.master ? 'on' : 'off'}`} />}
        />
      </ListGroup>

      {prefs.master ? (
        <>
          <ListGroup title={S42_COPY.remindersSection}>
            {toggle(S42_COPY.reminderRows.routineDue, 'routineDue')}
            {toggle(S42_COPY.reminderRows.eventStarting, 'eventStarting')}
            {toggle(S42_COPY.reminderRows.courseDose, 'courseDose')}
            {toggle(S42_COPY.reminderRows.courseEndingSoon, 'courseEndingSoon')}
          </ListGroup>

          <ListGroup title={S42_COPY.encouragementSection}>
            {toggle(S42_COPY.encouragementRows.gentleReentry, 'gentleReentry')}
            {toggle(S42_COPY.encouragementRows.milestoneReached, 'milestoneReached')}
          </ListGroup>

          <ListGroup title="Digest">{toggle(S42_COPY.digestRow, 'dailyDigest')}</ListGroup>
          {prefs.dailyDigest ? (
            <Select label="Digest time" value={prefs.dailyDigestTime} options={DIGEST_TIME_OPTIONS} onChange={(v) => void patchPrefs({ dailyDigestTime: v })} />
          ) : null}

          {allSubsOff ? <EmptyLine>{`${S42_COPY.emptyHeadline}. ${S42_COPY.emptySubcopy}`}</EmptyLine> : null}
        </>
      ) : (
        // Off: still show one, so the choice is made knowing what would arrive.
        <ListGroup title="What a reminder looks like">
          <View style={{ paddingTop: 12 }}>
            <NotificationSample title={samples.routineDue?.title ?? ''} body={samples.routineDue?.body ?? ''} when={samples.routineDue?.when ?? 'now'} />
          </View>
        </ListGroup>
      )}
    </Screen>
  );
}
