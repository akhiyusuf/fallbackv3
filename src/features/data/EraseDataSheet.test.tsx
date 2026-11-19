/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockErase = jest.fn();
jest.mock('@/services/data', () => ({ eraseAllData: () => mockErase() }));

import { useAgentAccessStore } from '@/features/agents/store';
import { useSoundStore } from '@/services/sfx';

import { S48_COPY } from './copy';
import { EraseDataSheet } from './EraseDataSheet';

describe('Erase all data sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockErase.mockResolvedValue({ ok: true, value: undefined });
  });
  afterEach(() => jest.restoreAllMocks());

  it('after an erase, the choices held in memory go back to first-run defaults and nothing is left behind the splash', async () => {
    useSoundStore.setState({ on: false });
    useAgentAccessStore.setState({ enabled: true });
    const dismissAll = jest.spyOn(router, 'dismissAll').mockImplementation(() => {});
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<EraseDataSheet visible onClose={jest.fn()} />);
    await user.press(screen.getByLabelText(S48_COPY.eraseButton));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/splash'));
    expect(dismissAll).toHaveBeenCalled();
    expect(useSoundStore.getState().on).toBe(true);
    expect(useAgentAccessStore.getState().enabled).toBe(false);
  });

  it('a failed erase changes nothing and goes nowhere', async () => {
    mockErase.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'x' } });
    useSoundStore.setState({ on: false });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<EraseDataSheet visible onClose={jest.fn()} />);
    await user.press(screen.getByLabelText(S48_COPY.eraseButton));
    await waitFor(() => expect(screen.getByText(S48_COPY.midWipeFailure)).toBeTruthy());
    expect(replace).not.toHaveBeenCalled();
    expect(useSoundStore.getState().on).toBe(false);
  });
});
