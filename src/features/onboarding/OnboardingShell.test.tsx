/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { Dimensions, Text as RNText } from 'react-native';
import { render, screen } from '@testing-library/react-native';

jest.mock('@/queries', () => ({ useUpdateSettings: () => ({ mutateAsync: jest.fn().mockResolvedValue({ ok: true }) }) }));
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
    first.utils.unmount();
    first.spy.mockRestore();

    const second = await renderAt(390, 844, 2);
    expect(screen.getByLabelText('Back')).toBeTruthy();
    second.utils.unmount();
    second.spy.mockRestore();
  });
});
