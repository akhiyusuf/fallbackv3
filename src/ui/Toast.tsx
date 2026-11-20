/**
 * Toast — single host mounted once in app/_layout.tsx (D2).
 * One look for every toast. Daily logs pass a state icon, an XP detail and an
 * Undo action. It always sits ABOVE the tab bar, the add button and any pinned
 * action bar — never on top of them.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Check, CheckCheck, Minus } from 'lucide-react-native';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT_SIZE, PALETTES, RADIUS, SPACE, useTheme } from '@/theme';
import { useToastStore } from '@/app-shell/stores/toast';
import { Text } from '@/ui/AppText';

const AUTO_DISMISS_MS = 3200;
const AUTO_DISMISS_WITH_ACTION_MS = 5000;
/** Height of the bottom tab bar the toast must clear. */
export const TAB_BAR_HEIGHT = 68;
/** Width reserved on the right for the round add button on tab screens. */
const FAB_RESERVE = 56 + SPACE.s2;
const ACTION_BAR_HEIGHT = 44 + 4 + SPACE.s3 * 2;

/**
 * What a screen reader says for the toast: the message, then its detail. A message that already ends
 * in a full stop is not given a second mark before the detail ("Ideal done. +10 XP", not "Ideal done., +10 XP").
 */
export function spokenMessage(message: string, detail?: string): string {
  if (!detail) return message;
  return `${message}${/[.!?…]$/.test(message) ? '' : ','} ${detail}`;
}

export function Toast() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as readonly string[];
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  const actionBars = useToastStore((s) => s.actionBars);

  useEffect(() => {
    if (!toast) return;
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility?.(spokenMessage(toast.message, toast.detail));
    const timer = setTimeout(hide, toast.action ? AUTO_DISMISS_WITH_ACTION_MS : AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;

  // Inverse surface: dark on light scheme, light on dark scheme.
  const inverse = PALETTES[t.scheme === 'dark' ? 'light' : 'dark'];
  const onTabs = segments[0] === '(tabs)';
  const bottom = insets.bottom + (onTabs ? TAB_BAR_HEIGHT + SPACE.s2 : actionBars > 0 ? ACTION_BAR_HEIGHT + SPACE.s2 : SPACE.s4);
  const right = onTabs ? SPACE.s3 + FAB_RESERVE : SPACE.s3;

  const Icon = toast.icon === 'ideal' ? CheckCheck : toast.icon === 'fallback' ? Check : toast.icon === 'skip' ? Minus : null;
  const iconBg = toast.icon === 'ideal' ? inverse.ideal : toast.icon === 'fallback' ? inverse.fallback : inverse.off;

  // The alert is ONE focus stop that reads the message first. Dismiss and the action are
  // exposed as named accessibility actions on it, so Dismiss is its own action and never the
  // thing focus lands on. The visible buttons below stay as they were for touch.
  const dismissAction = { name: 'dismiss', label: 'Dismiss' };
  const actions = toast.action ? [dismissAction, { name: 'action', label: toast.action.label }] : [dismissAction];

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={spokenMessage(toast.message, toast.detail)}
      accessibilityLiveRegion="polite"
      accessibilityActions={actions}
      onAccessibilityAction={(event) => {
        const name = event.nativeEvent.actionName;
        if (name === 'dismiss') hide();
        else if (name === 'action' && toast.action) {
          const action = toast.action;
          hide();
          action.onPress();
        }
      }}
      style={[styles.root, { backgroundColor: inverse.bgAlt, borderColor: inverse.border, bottom, right }]}
    >
      <Pressable onPress={hide} accessible={false} style={styles.body} accessibilityRole="button" accessibilityLabel="Dismiss">
        {Icon ? (
          <View style={[styles.iconDot, { backgroundColor: iconBg }]}>
            <Icon size={14} color={inverse.iconOnSignal} />
          </View>
        ) : null}
        <Text style={[styles.message, { color: inverse.text }]} numberOfLines={2}>
          {toast.message}
          {toast.detail ? <Text style={[styles.detail, { color: inverse.xp }]}>{`  ${toast.detail}`}</Text> : null}
        </Text>
      </Pressable>
      {toast.action ? (
        <Pressable
          onPress={() => {
            const action = toast.action;
            hide();
            action?.onPress();
          }}
          accessible={false}
          accessibilityRole="button"
          accessibilityLabel={toast.action.label}
          hitSlop={8}
          style={styles.action}
        >
          <Text style={[styles.actionLabel, { color: inverse.text }]}>{toast.action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: SPACE.s3,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACE.s3,
    paddingRight: SPACE.s1,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, paddingVertical: SPACE.s2 + 2, paddingRight: SPACE.s2 },
  iconDot: { width: 24, height: 24, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  message: { flexShrink: 1, fontSize: FONT_SIZE.sm, lineHeight: 20, fontWeight: '600' },
  detail: { fontWeight: '700' },
  action: { minHeight: 44, paddingHorizontal: SPACE.s2 + 4, justifyContent: 'center' },
  actionLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', textDecorationLine: 'underline' },
});
