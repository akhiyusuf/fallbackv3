/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useThemeStore, useToastStore } from '@/app-shell';
import { S43_COPY } from '@/features/settings/copy';
import { ACCENTS, buildTheme, DEFAULT_ACCENT, THEME_LABELS, THEME_ORDER, ThemeContext } from '@/theme';

const mockSettingsData: { current: unknown } = { current: undefined };
const mockUpdateSettingsMutateAsync = jest.fn();
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettingsMutateAsync }),
}));

import S43ThemeAndAccent from './theme';

/**
 * `app/_layout.tsx` (M0-owned, frozen) is what derives `ThemeContext`'s live value from
 * `useThemeStore` in the real app — see its `AppShell` component. This harness reproduces
 * just that wiring so the "live" half of F8 (an accent pick recolouring the preview
 * IMMEDIATELY, in the same render pass the swatch tap causes) is actually exercised here,
 * the same way it is in the shipped app.
 */
function renderWithLiveTheme(ui: React.ReactElement) {
  function Harness() {
    const mode = useThemeStore((s) => s.mode);
    const accent = useThemeStore((s) => s.accent);
    const theme = buildTheme(mode === 'dark' ? 'dark' : 'light', accent);
    return <ThemeContext.Provider value={theme}>{ui}</ThemeContext.Provider>;
  }
  return render(<Harness />);
}

/** Recursively collects every `backgroundColor`/`stroke` value in a rendered tree. */
function collectColors(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { props?: Record<string, unknown>; children?: unknown[] };
  const style = n.props?.style;
  const styles = Array.isArray(style) ? style : [style];
  for (const s of styles) {
    const bg = (s as { backgroundColor?: string } | undefined)?.backgroundColor;
    if (bg) out.push(bg);
  }
  if (typeof n.props?.stroke === 'string') out.push(n.props.stroke as string);
  for (const child of n.children ?? []) collectColors(child, out);
  return out;
}

function isSelected(element: { props: { accessibilityState?: { selected?: boolean; checked?: boolean } } }): boolean {
  return !!(element.props.accessibilityState?.selected ?? element.props.accessibilityState?.checked);
}

describe('S43 — Theme & Accent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = { theme: 'auto', accent: DEFAULT_ACCENT };
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
    useThemeStore.setState({ mode: 'auto', accent: DEFAULT_ACCENT });
    useToastStore.setState({ toast: null });
  });

  it('default: Auto appearance and Forge accent are pre-selected', async () => {
    await renderWithLiveTheme(<S43ThemeAndAccent />);
    expect(isSelected(screen.getByRole('tab', { name: 'Auto' }))).toBe(true);
    expect(isSelected(screen.getByRole('tab', { name: 'Light' }))).toBe(false);
    expect(screen.getByLabelText(`${THEME_LABELS[DEFAULT_ACCENT]}, selected`)).toBeTruthy();
  });

  it('renders the accent helper, the more-colors helper and the preview note verbatim', async () => {
    await renderWithLiveTheme(<S43ThemeAndAccent />);
    expect(screen.getByText(S43_COPY.accentHelper)).toBeTruthy();
    expect(screen.getByText(S43_COPY.moreColoursHelper)).toBeTruthy();
    expect(screen.getByText(S43_COPY.previewNote)).toBeTruthy();
  });

  it('picking a new accent recolors the preview card live', async () => {
    const user = userEvent.setup();
    await renderWithLiveTheme(<S43ThemeAndAccent />);

    const colorsBefore = collectColors(screen.getByTestId('theme-preview'));
    expect(colorsBefore).toContain(ACCENTS[DEFAULT_ACCENT].base);

    await user.press(screen.getByLabelText(THEME_LABELS.indigo));
    await waitFor(() => expect(useThemeStore.getState().accent).toBe('indigo'));

    const colorsAfter = collectColors(screen.getByTestId('theme-preview'));
    expect(colorsAfter).toContain(ACCENTS.indigo.base);
    expect(colorsAfter).not.toContain(ACCENTS[DEFAULT_ACCENT].base);
  });

  it('the preview log buttons do NOT recolor with the accent — they stay on their fixed signal colors', async () => {
    const user = userEvent.setup();
    await renderWithLiveTheme(<S43ThemeAndAccent />);

    const doneBefore = collectColors(screen.getByLabelText(`${S43_COPY.previewTaskName}: Done`));
    const fallbackBefore = collectColors(screen.getByLabelText(`${S43_COPY.previewTaskName}: Fallback`));
    expect(doneBefore.length).toBeGreaterThan(0);

    await user.press(screen.getByLabelText(THEME_LABELS.plum));
    await waitFor(() => expect(useThemeStore.getState().accent).toBe('plum'));

    expect(collectColors(screen.getByLabelText(`${S43_COPY.previewTaskName}: Done`))).toEqual(doneBefore);
    expect(collectColors(screen.getByLabelText(`${S43_COPY.previewTaskName}: Fallback`))).toEqual(fallbackBefore);
    expect(doneBefore).not.toContain(ACCENTS.plum.base);
    expect(fallbackBefore).not.toContain(ACCENTS.plum.base);
  });

  it.each(THEME_ORDER.map((key) => [key, THEME_LABELS[key]] as const))('picking the %s accent saves it and applies it', async (key, label) => {
    const user = userEvent.setup();
    await renderWithLiveTheme(<S43ThemeAndAccent />);
    // The label gains ", selected" when it is already the accent, so match both forms.
    await user.press(screen.getByLabelText(new RegExp(`^${label}(, selected)?$`)));
    await waitFor(() => expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ accent: key }));
    expect(useThemeStore.getState().accent).toBe(key);
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('picking a color from "More colors" saves that hue (Amber, the first swatch)', async () => {
    const user = userEvent.setup();
    await renderWithLiveTheme(<S43ThemeAndAccent />);
    await user.press(screen.getByLabelText('Amber, color 1 of 15'));
    await waitFor(() => expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ accent: 'hue-52' }));
    expect(useThemeStore.getState().accent).toBe('hue-52');
  });

  it.each([
    ['Light', 'light'],
    ['Dark', 'dark'],
    ['Auto', 'auto'],
  ] as const)('the %s appearance saves the theme and applies it', async (label, value) => {
    const user = userEvent.setup();
    await renderWithLiveTheme(<S43ThemeAndAccent />);
    await user.press(screen.getByRole('tab', { name: label }));
    await waitFor(() => expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ theme: value }));
    expect(useThemeStore.getState().mode).toBe(value);
  });

  it('a failed appearance save reverts to the prior mode and shows the calm warning toast', async () => {
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await renderWithLiveTheme(<S43ThemeAndAccent />);
    await user.press(screen.getByRole('tab', { name: 'Dark' }));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S43_COPY.errorToast));
    expect(useToastStore.getState().toast?.tone).toBe('warning');
    expect(useThemeStore.getState().mode).toBe('auto');
  });

  it('a failed accent save reverts the selection and shows the calm retry toast', async () => {
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await renderWithLiveTheme(<S43ThemeAndAccent />);
    await user.press(screen.getByLabelText(THEME_LABELS.berry));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S43_COPY.errorToast));
    expect(useToastStore.getState().toast?.tone).toBe('warning');
    expect(useThemeStore.getState().accent).toBe(DEFAULT_ACCENT);
  });

  it('tap back chevron navigates to S41', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await renderWithLiveTheme(<S43ThemeAndAccent />);
    await user.press(screen.getByLabelText('Back'));
    expect(push).toHaveBeenCalledWith('/settings');
    push.mockRestore();
  });
});
