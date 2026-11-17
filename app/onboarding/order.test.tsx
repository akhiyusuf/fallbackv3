/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ComponentType } from 'react';

// The seven onboarding steps, in the order they are shown (DESIGN_DECISIONS: "Onboarding order").
// Each step's Next (or Save) must lead to the next entry; the last one leads to Today.
const ORDER = [
  '/onboarding/concept',
  '/onboarding/hook',
  '/onboarding/types',
  '/onboarding/consistency',
  '/onboarding/personalize',
  '/onboarding/notifications-primer',
  '/onboarding/first-task',
] as const;

jest.mock('@/queries', () => ({
  useSettings: () => ({
    data: { accent: 'forge-orange', theme: 'auto', notifications: { master: false, routineDue: true, eventStarting: true, courseDose: true, gentleReentry: true } },
  }),
  useUpdateSettings: () => ({ mutateAsync: jest.fn().mockResolvedValue({ ok: true }) }),
  useCreateTask: () => ({ mutateAsync: jest.fn().mockResolvedValue({ ok: true, value: 'task-1' }) }),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/notifications', () => ({
  notifications: { requestPermission: jest.fn().mockResolvedValue({ ok: true, value: true }), reschedule: jest.fn().mockResolvedValue({ ok: true, value: undefined }) },
  initNotificationsBridge: jest.fn(),
}));
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: jest.fn() }));

import S02OnboardingHook from './hook';
import S03OnboardingConcept from './concept';
import S04OnboardingFourWaysToPlan from './types';
import S05OnboardingConsistencyNotPerfection from './consistency';
import S06OnboardingMakeItYours from './personalize';
import S07NotificationPermissionPrimer from './notifications-primer';
import S08OnboardingFirstTask from './first-task';
import { S08_COPY } from '@/features/onboarding/copy';

type Case = { step: number; name: string; Screen: ComponentType; advance: (user: ReturnType<typeof userEvent.setup>) => Promise<void>; to: string; method: 'push' | 'replace' };

const CASES: readonly Case[] = [
  { step: 1, name: 'S03 concept', Screen: S03OnboardingConcept, advance: (u) => press(u, 'Next'), to: ORDER[1]!, method: 'push' },
  { step: 2, name: 'S02 hook', Screen: S02OnboardingHook, advance: (u) => press(u, 'Next'), to: ORDER[2]!, method: 'push' },
  { step: 3, name: 'S04 types', Screen: S04OnboardingFourWaysToPlan, advance: (u) => press(u, 'Next'), to: ORDER[3]!, method: 'push' },
  { step: 4, name: 'S05 consistency', Screen: S05OnboardingConsistencyNotPerfection, advance: (u) => press(u, 'Next'), to: ORDER[4]!, method: 'push' },
  { step: 5, name: 'S06 personalize', Screen: S06OnboardingMakeItYours, advance: (u) => press(u, 'Next'), to: ORDER[5]!, method: 'push' },
  { step: 6, name: 'S07 notifications primer', Screen: S07NotificationPermissionPrimer, advance: (u) => press(u, 'Not now'), to: ORDER[6]!, method: 'push' },
  {
    step: 7,
    name: 'S08 first task',
    Screen: S08OnboardingFirstTask,
    advance: async (u) => {
      await u.type(screen.getByLabelText(S08_COPY.nameLabel), 'Morning workout');
      await u.type(screen.getByLabelText(S08_COPY.idealLabel), 'Full workout');
      await u.type(screen.getByLabelText(S08_COPY.fallbackLabel), '10 pushups');
      await press(u, S08_COPY.save);
    },
    to: '/today?justAdded=1',
    method: 'replace',
  },
];

async function press(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.press(screen.getByLabelText(label));
}

describe('onboarding step order', () => {
  it('the seven steps are the seven routes in ORDER, and the last one leads to Today', () => {
    expect(ORDER).toHaveLength(7);
    expect(ORDER[0]).toBe('/onboarding/concept');
    expect(CASES.map((c) => c.to)).toEqual([...ORDER.slice(1), '/today?justAdded=1']);
  });

  it.each(CASES.map((c) => [c.name, c] as const))('%s shows its step number and leads to the next step', async (_name, c) => {
    const spies = { push: jest.spyOn(router, 'push').mockImplementation(() => {}), replace: jest.spyOn(router, 'replace').mockImplementation(() => {}) };
    const user = userEvent.setup();
    await render(<c.Screen />);
    await waitFor(() => expect(screen.getByLabelText(`Step ${c.step} of 7`)).toBeTruthy());
    await c.advance(user);
    await waitFor(() => expect(spies[c.method]).toHaveBeenCalledWith(c.to));
    spies.push.mockRestore();
    spies.replace.mockRestore();
  });
});
