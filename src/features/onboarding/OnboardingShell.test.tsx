/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { BackHandler, Dimensions, Text as RNText } from 'react-native';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useToastStore } from '@/app-shell/stores/toast';
import { ONBOARDING_SHELL_COPY } from './copy';

const mockUpdateSettingsMutateAsync = jest.fn();
jest.mock('@/queries', () => ({ useUpdateSettings: () => ({ mutateAsync: mockUpdateSettingsMutateAsync }) }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import { OnboardingShell, useOnboardingDensity } from './OnboardingShell';

// Reports the density the shell chose for the window (planFor itself is not exported; its result
// is read back through useOnboardingDensity, the way a step reads it).
function Probe() {
  const density = useOnboardingDensity();
  return <RNText>{`density:${density}`}</RNText>;
}

async function renderAt(width: number, height: number, step: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 2) {
  const spy = jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height, scale: 2, fontScale: 1 });
  const utils = await render(
    <OnboardingShell step={step} headline="Headline" body="Body">
      <Probe />
    </OnboardingShell>,
  );
  return { spy, utils };
}

describe('OnboardingShell (the top bar and fit for all seven steps)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('a tall phone keeps the regular type setting', async () => {
    const { spy } = await renderAt(390, 1000);
    expect(await screen.findByText('density:regular')).toBeTruthy();
    spy.mockRestore();
  });

  it('a 390 by 844 phone tightens to compact', async () => {
    const { spy } = await renderAt(390, 844);
    expect(await screen.findByText('density:compact')).toBeTruthy();
    spy.mockRestore();
  });

  it('a short 360 by 600 window uses the tight setting, so the step still fits', async () => {
    const { spy } = await renderAt(360, 600);
    expect(await screen.findByText('density:tight')).toBeTruthy();
    spy.mockRestore();
  });

  it('shows one dot per step (seven) and the step count', async () => {
    const { spy } = await renderAt(390, 844, 3);
    for (let dot = 1; dot <= 7; dot++) {
      expect(screen.getByTestId(`onboarding-dot-${dot}`, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(screen.getByLabelText('Step 3 of 7')).toBeTruthy();
    spy.mockRestore();
  });

  it('Back is hidden on step 1 and shown from step 2', async () => {
    const first = await renderAt(390, 844, 1);
    expect(screen.queryByLabelText('Back')).toBeNull();
    await first.utils.unmount();
    first.spy.mockRestore();

    const second = await renderAt(390, 844, 2);
    expect(screen.getByLabelText('Back')).toBeTruthy();
    await second.utils.unmount();
    second.spy.mockRestore();
  });
});

describe('OnboardingShell Skip (the save before leaving)', () => {
  afterEach(() => jest.restoreAllMocks());
  async function renderSkipShell() {
    return renderAt(390, 844, 3);
  }

  beforeEach(() => {
    mockUpdateSettingsMutateAsync.mockReset();
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
    useToastStore.setState({ toast: null });
  });

  it('a saved Skip navigates to /today and shows no toast', async () => {
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await renderSkipShell();
    await user.press(screen.getByLabelText('Skip onboarding'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today'));
    expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ onboardingCompletedAt: expect.any(String) });
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('a failed save ({ ok: false }) shows the warning toast and does not navigate', async () => {
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await renderSkipShell();
    await user.press(screen.getByLabelText('Skip onboarding'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(ONBOARDING_SHELL_COPY.skipFailure));
    expect(useToastStore.getState().toast?.tone).toBe('warning');
    expect(replace).not.toHaveBeenCalled();
  });

  it('a save that throws shows the same warning toast and does not navigate', async () => {
    mockUpdateSettingsMutateAsync.mockRejectedValue(new Error('database closed'));
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await renderSkipShell();
    await user.press(screen.getByLabelText('Skip onboarding'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(ONBOARDING_SHELL_COPY.skipFailure));
    expect(useToastStore.getState().toast?.tone).toBe('warning');
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('OnboardingShell leaving and the phone back button', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    mockUpdateSettingsMutateAsync.mockReset();
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
  });

  it('Skip clears the stack before going to Today, so back from Today cannot return to a step', async () => {
    const calls: string[] = [];
    jest.spyOn(router, 'dismissAll').mockImplementation(() => void calls.push('dismissAll'));
    jest.spyOn(router, 'replace').mockImplementation(() => void calls.push('replace'));
    const user = userEvent.setup();
    await renderAt(390, 844, 4);
    await user.press(screen.getByLabelText('Skip onboarding'));
    await waitFor(() => expect(calls).toEqual(['dismissAll', 'replace']));
  });

  it('the phone back button on a step that is alone in the stack (after a resume) goes to the step before', async () => {
    const handlers: (() => boolean | null | undefined)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
      handlers.push(h);
      return { remove: () => undefined };
    });
    jest.spyOn(router, 'canGoBack').mockReturnValue(false);
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await renderAt(390, 844, 4);
    expect(handlers.map((h) => h())).toContain(true);
    expect(replace).toHaveBeenCalledWith('/onboarding/types');
  });

  it('the phone back button is left to the stack when there is a step to go back to, and step 1 does not listen', async () => {
    const handlers: (() => boolean | null | undefined)[] = [];
    const add = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
      handlers.push(h);
      return { remove: () => undefined };
    });
    jest.spyOn(router, 'canGoBack').mockReturnValue(true);
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const view = await renderAt(390, 844, 4);
    expect(handlers.map((h) => h())).not.toContain(true);
    expect(replace).not.toHaveBeenCalled();
    await view.utils.unmount();
    add.mockClear();
    await renderAt(390, 844, 1);
    expect(add).not.toHaveBeenCalled();
  });

  it('a second Skip tap while the first is saving saves once', async () => {
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    let release: (v: { ok: true }) => void = () => {};
    mockUpdateSettingsMutateAsync.mockReturnValue(new Promise((r) => (release = r)));
    const view = await renderAt(390, 844, 4);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Skip onboarding'));
    await user.press(screen.getByLabelText('Skip onboarding'));
    release({ ok: true });
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledTimes(1);
    await view.utils.unmount();
  });
});
