/**
 * Browser-preview only (not part of the app). Exposes a small control surface on
 * `window.__fallbackPreview` so the preview page can load sample data, start over and
 * jump between screens. Sample data is written through the app's own repositories and
 * logging functions, so XP, consistency and achievements are computed by the real code.
 */
import { router } from 'expo-router';
import type { QueryClient } from '@tanstack/react-query';

import { repos, store } from '@/db';
import { addDays, now, today, weekdayOf } from '@/lib/date';
import { newId } from '@/lib/id';
import { __testing__ } from '@/queries/mutations';
import type { ChipState, Step, Task, Weekday } from '@/types';

type Seed = Partial<Task> & Pick<Task, 'type' | 'name' | 'icon' | 'color'> & { ideal?: string[]; fallback?: string[] };

async function insertTask(seed: Seed, createdDaysAgo: number): Promise<string> {
  const id = newId();
  const created = new Date(Date.now() - createdDaysAgo * 864e5).toISOString() as Task['createdAt'];
  const { ideal = [], fallback = [], ...rest } = seed;
  const task: Task = {
    id, note: null, isAsNeeded: false, cadence: null, eventDate: null, timeOfDay: null, startDate: null, endDate: null,
    dosesPerDay: 1, isTracked: true, importance: null, necessity: null, todoDoneAt: null, snoozable: true, isNote: false, priorityRank: null,
    createdAt: created, updatedAt: created, deletedAt: null, ...rest,
  } as Task;
  const steps: Step[] = [
    ...ideal.map((text, i): Step => ({ id: newId(), taskId: id, role: 'ideal', text, position: i, dueWeekdays: null })),
    ...fallback.map((text, i): Step => ({ id: newId(), taskId: id, role: 'fallback', text, position: i, dueWeekdays: null })),
  ];
  const r = await repos.tasks.insert(task, steps);
  if (!r.ok) throw new Error('Could not add sample task: ' + seed.name);
  return id;
}

async function seedSample(): Promise<void> {
  const t = today();
  const d = (n: number) => addDays(t, n);
  const current = await repos.settings.get();
  await repos.settings.patch({
    onboardingCompletedAt: now(),
    tenureAnchorDate: d(-24),
    // The sample person tapped Allow in onboarding.
    notifications: { ...current.notifications, master: true, routineDue: true, eventStarting: true, courseDose: true, gentleReentry: true },
  });

  const workout = await insertTask({ type: 'routine', name: 'Morning workout', icon: 'Dumbbell', color: 'forge-orange', cadence: { kind: 'daily' }, timeOfDay: '07:00', importance: 'high', necessity: 'recommended', ideal: ['20-minute run', 'Stretch for 5 minutes'], fallback: ['10 push-ups'] }, 21);
  const read = await insertTask({ type: 'routine', name: 'Read before bed', icon: 'BookOpen', color: 'indigo', cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] as Weekday[] }, timeOfDay: '21:30', importance: 'med', necessity: 'optional', ideal: ['Read 20 pages'], fallback: ['Read one page'] }, 21);
  await insertTask({ type: 'routine', name: 'Headache relief', icon: 'Pill', color: 'plum', importance: 'low', isAsNeeded: true, isTracked: false, snoozable: false }, 10);
  await insertTask({ type: 'course', name: 'Antibiotics', icon: 'Pill', color: 'berry', cadence: { kind: 'daily' }, startDate: d(-3), endDate: d(4), dosesPerDay: 2, snoozable: false, importance: 'high', necessity: 'must-do', ideal: ['Take with food'], fallback: ['Take the dose'] }, 3);
  await insertTask({ type: 'event', name: 'Dentist check-up', icon: 'Stethoscope', color: 'berry', eventDate: d(3), timeOfDay: '19:00', isTracked: false, importance: 'high', necessity: 'recommended' }, 5);
  await insertTask({ type: 'todo', name: 'Renew passport', icon: 'FileText', color: 'indigo', isTracked: false, importance: 'high' }, 6);
  await insertTask({ type: 'todo', name: 'Send the invoice', icon: 'Briefcase', color: 'forge-orange', isTracked: false, importance: 'med' }, 2);

  // Three weeks of history, oldest first. Today is left open so there is something to tap.
  const workoutPattern: (ChipState | 'off' | null)[] = ['done', 'done', 'fallback', 'done', null, 'done', 'fallback', 'done', 'done', 'off', 'fallback', 'done', 'done', 'skip', 'done', 'fallback', 'done', 'done', null, 'done', 'fallback'];
  const readPattern: (ChipState | null)[] = ['done', 'fallback', 'done', 'done', null, 'fallback', 'done', 'done', 'fallback', 'done', 'done', null, 'done', 'fallback', 'done'];
  for (let i = 0; i < workoutPattern.length; i++) {
    const date = d(i - workoutPattern.length);
    const p = workoutPattern[i];
    if (p === 'off') await __testing__.markOffDay({ date, taskId: null, mark: true });
    else if (p) await __testing__.logState({ taskId: workout as never, date, chip: p });
  }
  let ri = 0;
  for (let n = -21; n < 0 && ri < readPattern.length; n++) {
    const date = d(n);
    if (weekdayOf(date) > 5) continue;
    const p = readPattern[ri++];
    if (p) await __testing__.logState({ taskId: read as never, date, chip: p });
  }
}

export function installPreviewBridge(queryClient: QueryClient): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __fallbackPreview?: Record<string, unknown> };
  const refresh = async () => { await queryClient.invalidateQueries(); };
  w.__fallbackPreview = {
    ...(w.__fallbackPreview ?? {}),
    go: (path: string) => router.push(path as never),
    replace: (path: string) => router.replace(path as never),
    async loadSample() {
      await store.eraseAll();
      await seedSample();
      queryClient.clear();
      router.replace('/today' as never);
      await refresh();
    },
    async startOver() {
      try { Object.keys(localStorage).filter((k) => k.startsWith('fallback-preview:')).forEach((k) => localStorage.removeItem(k)); } catch { /* no storage */ }
      await store.eraseAll();
      queryClient.clear();
      router.replace('/splash' as never);
    },
    repos,
    ready: true,
  };
  window.dispatchEvent(new Event('fallback-preview:ready'));
}
