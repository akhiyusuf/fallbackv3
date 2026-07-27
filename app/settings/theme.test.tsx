/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useThemeStore, useToastStore } from '@/app-shell';
import { ACCENTS, DEFAULT_ACCENT, PALETTES } from '@/theme';

const mockSettingsData: { current: unknown } = { current: undefined };
const mockUpdateSettingsMutateAsync = jest.fn();
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettingsMutateAsync }),
}));

import S43ThemeAndAccent from './theme';
import { S43_COPY } from '@/features/settings/copy';

describe('S43 — Theme & Accent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = { theme: 'auto', accent: DEFAULT_ACCENT };
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
    useThemeStore.setState({ mode: 'auto', accent: DEFAULT_ACCENT });
    useToastStore.setState({ toast: null });
  });

  it('default: Auto theme and Forge Orange accent are pre-selected', async () => {
    await render(<S43ThemeAndAccent />);
    expect(screen.getByLabelText('Appearance, Auto selected')).toBeTruthy();
    expect(screen.getByLabelText('Accent color, Forge Orange selected')).toBeTruthy();
  });

  it('renders the accent-only helper and the accent-invariance caption verbatim', async () => {
    await render(<S43ThemeAndAccent />);
    expect(screen.getByText(S43_COPY.accentHelper)).toBeTruthy();
    expect(screen.getByText(S43_COPY.previewCaption)).toBeTruthy();
  });

  /** Recursively collects every `backgroundColor`/`stroke` value in a rendered JSON tree. */
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

  it('picking a new accent recolors the Button and ProgressRing in the preview, live', async () => {
    const user = userEvent.setup();
    await render(<S43ThemeAndAccent />);

    const colorsBefore = collectColors(screen.getByTestId('theme-preview'));
    expect(colorsBefore).toContain(ACCENTS[DEFAULT_ACCENT].base); // the primary Button's face colour + ProgressRing's stroke

    await user.press(screen.getByLabelText('Accent color, Indigo'));
    await waitFor(() => expect(useThemeStore.getState().accent).toBe('indigo'));

    const colorsAfter = collectColors(screen.getByTestId('theme-preview'));
    expect(colorsAfter).toContain(ACCENTS.indigo.base);
    expect(colorsAfter).not.toContain(ACCENTS[DEFAULT_ACCENT].base);
  });

  it('the four StateChips in the preview do NOT recolor with the accent — they stay on their fixed signal colours', async () => {
    const user = userEvent.setup();
    await render(<S43ThemeAndAccent />);

    const doneColorsBefore = collectColors(screen.getByTestId('preview-chip-done'));
    const fallbackColorsBefore = collectColors(screen.getByTestId('preview-chip-fallback'));
    const skipColorsBefore = collectColors(screen.getByTestId('preview-chip-skip'));
    expect(doneColorsBefore).toContain(PALETTES.light.ideal);
    expect(fallbackColorsBefore).toContain(PALETTES.light.fallback);
    expect(skipColorsBefore).toContain(PALETTES.light.off);

    await user.press(screen.getByLabelText('Accent color, Plum'));
    await waitFor(() => expect(useThemeStore.getState().accent).toBe('plum'));

    // Same fixed hexes after the accent switch — and, critically, none of them picked up
    // the new accent's hex. This is the concrete proof of the accent-invariance rule: the
    // Button/ProgressRing preview test above DOES pick up the new accent hex; these three
    // do not, because `StateChip`'s `chipVisual` map reads `t.color.ideal/fallback/off`,
    // never `t.accent.*` (src/ui/StateChip.tsx).
    const doneColorsAfter = collectColors(screen.getByTestId('preview-chip-done'));
    const fallbackColorsAfter = collectColors(screen.getByTestId('preview-chip-fallback'));
    const skipColorsAfter = collectColors(screen.getByTestId('preview-chip-skip'));
    expect(doneColorsAfter).toEqual(doneColorsBefore);
    expect(fallbackColorsAfter).toEqual(fallbackColorsBefore);
    expect(skipColorsAfter).toEqual(skipColorsBefore);
    expect(doneColorsAfter).not.toContain(ACCENTS.plum.base);
    expect(fallbackColorsAfter).not.toContain(ACCENTS.plum.base);
    expect(skipColorsAfter).not.toContain(ACCENTS.plum.base);
  });

  it('a persist failure reverts the selection and shows the calm retry toast', async () => {
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await render(<S43ThemeAndAccent />);
    await user.press(screen.getByLabelText('Accent color, Berry'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S43_COPY.errorToast));
    expect(useThemeStore.getState().accent).toBe(DEFAULT_ACCENT);
  });

  it('tap back chevron navigates to S41', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S43ThemeAndAccent />);
    await user.press(screen.getByLabelText('Back'));
    expect(push).toHaveBeenCalledWith('/settings');
    push.mockRestore();
  });
});
