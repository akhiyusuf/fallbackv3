/**
 * M0 kit — Fallback-custom `Toast`. A single host, mounted once by `app/_layout.tsx`,
 * reads `useToastStore` and renders the current entry (if any). Screens never render their
 * own `<Toast/>` instance — they call `useToastStore.getState().show(message, tone)`.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';
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

  return (
    <Pressable
      onPress={hide}
      accessibilityRole="alert"
      accessibilityLabel={toast.message}
      accessibilityLiveRegion="polite"
      style={[styles.root, { backgroundColor: t.color.text }, toneStyle(toast.tone, t)]}
    >
      <Text style={[styles.message, { color: t.color.bg }]}>{toast.message}</Text>
    </Pressable>
  );
}

function toneStyle(tone: ToastTone, t: ReturnType<typeof useTheme>) {
  if (tone === 'warning') return { backgroundColor: t.color.dangerDeep };
  if (tone === 'success') return { backgroundColor: t.color.idealDeep };
  return {};
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
