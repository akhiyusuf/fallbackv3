/**
 * M0 kit — Fallback-custom `Toast`. A single host, mounted once by `app/_layout.tsx`,
 * reads `useToastStore` and renders the current entry (if any). Screens never render their
 * own `<Toast/>` instance — they call `useToastStore.getState().show(message, tone)`.
 *
 * Tone treatment follows ARCHITECTURE §10: the danger token is reserved for
 * destructive-action confirm buttons and "never spreads to a surrounding icon, banner or
 * background" — a failed-write `warning` toast (e.g. "Couldn't save that — try again",
 * S09/S20/S42) is calm, not alarming, so it never paints a danger-family fill. `success`
 * follows the design's own tinted-surface pattern for informational banners (S09's off
 * banner: soft bg + deep text) rather than putting text on a saturated signal fill.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { RADIUS, SPACE, useTheme, type Theme } from '@/theme';
import { useToastStore, type ToastTone } from '@/app-shell/stores/toast';

const AUTO_DISMISS_MS = 3200;

export function Toast() {
  const t = useTheme();
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!toast) return;
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility?.(toast.message);
    }
    const timer = setTimeout(hide, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;

  const { bg, text } = toneColors(toast.tone, t);

  return (
    <Pressable
      onPress={hide}
      accessibilityRole="alert"
      accessibilityLabel={toast.message}
      accessibilityLiveRegion="polite"
      style={[styles.root, { backgroundColor: bg }]}
    >
      <Text style={[styles.message, { color: text }]}>{toast.message}</Text>
    </Pressable>
  );
}

function toneColors(tone: ToastTone, t: Theme): { bg: string; text: string } {
  if (tone === 'success') return { bg: t.color.idealSoft, text: t.color.idealDeep };
  // A calm failed-write surface — never the danger family (ARCHITECTURE §10).
  if (tone === 'warning') return { bg: t.color.surface, text: t.color.textMuted };
  return { bg: t.color.text, text: t.color.bg };
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: SPACE.s3,
    right: SPACE.s3,
    bottom: SPACE.s4,
    borderRadius: RADIUS.md,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s3,
  },
  message: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
