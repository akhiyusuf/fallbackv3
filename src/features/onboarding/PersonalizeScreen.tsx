/** S06 — Onboarding: Make it yours. route: /onboarding/personalize. Features: F9, F8, F14. */
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeStore } from '@/app-shell';
import { useToastStore } from '@/app-shell';
import { useSettings, useUpdateSettings } from '@/queries';
import { ACCENTS, DEFAULT_ACCENT, SPACE, useTheme } from '@/theme';
import { Button } from '@/ui';
import { Switch } from '@/ui';
import type { AccentKey } from '@/types';

import { S06_COPY } from './copy';
import { useOnboardingStepMarker } from './useOnboardingResume';

const ACCENT_ORDER: readonly AccentKey[] = ['forge-orange', 'indigo', 'berry', 'plum'];

export function PersonalizeScreen() {
  const t = useTheme();
  const router = useRouter();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);
  useOnboardingStepMarker('/onboarding/personalize');

  const [remindersOn, setRemindersOn] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrating a previously-chosen accent if onboarding was interrupted and resumed — S06's own
  // "Loading" state: instant local read, no skeleton needed.
  useEffect(() => {
    if (settingsQuery.data) {
      setAccent(settingsQuery.data.accent);
      setRemindersOn(settingsQuery.data.notifications.master);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data?.accent, settingsQuery.data?.notifications.master]);

  async function handleNext() {
    const priorAccent = settingsQuery.data?.accent ?? DEFAULT_ACCENT;
    const priorMaster = settingsQuery.data?.notifications.master ?? false;
    const baselinePrefs = settingsQuery.data?.notifications;

    setSaving(true);
    const result = await updateSettings.mutateAsync({
      accent,
      notifications: baselinePrefs ? { ...baselinePrefs, master: remindersOn } : undefined,
    });
    setSaving(false);

    if (!result.ok) {
      setAccent(priorAccent);
      setRemindersOn(priorMaster);
      showToast(S06_COPY.saveFailure, 'warning');
      return;
    }

    router.push((remindersOn ? '/onboarding/notifications-primer' : '/onboarding/first-task') as Href);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {S06_COPY.headline}
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{S06_COPY.body}</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: t.color.text }]}>{S06_COPY.accentSectionLabel}</Text>
          <Text style={[styles.helper, { color: t.color.textMuted }]}>{S06_COPY.accentHelper}</Text>
          <View style={styles.swatchRow} accessibilityRole="radiogroup" accessibilityLabel={S06_COPY.accentSectionLabel}>
            {ACCENT_ORDER.map((key) => {
              const selected = accent === key;
              const swatch = ACCENTS[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => setAccent(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${swatch.label}${selected ? ', selected' : ''}`}
                  style={[styles.swatch, { backgroundColor: swatch.base }]}
                >
                  {selected ? <Check size={18} color={t.color.textOnAccent} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Button label={S06_COPY.previewLabel} onPress={() => {}} disabled accessibilityLabel="Preview, illustrative only" />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: t.color.text }]}>{S06_COPY.remindersSectionLabel}</Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: t.color.text }]}>{S06_COPY.remindersRowLabel}</Text>
            <Switch
              value={remindersOn}
              onValueChange={setRemindersOn}
              accessibilityLabel={`${S06_COPY.remindersRowLabel}, ${remindersOn ? 'on' : 'off'}`}
            />
          </View>
          <Text style={[styles.helper, { color: t.color.textMuted }]}>{S06_COPY.remindersHelper}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Next" onPress={handleNext} loading={saving} accessibilityLabel="Next" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: SPACE.s3, gap: SPACE.s4 },
  headline: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
  section: { gap: SPACE.s2 },
  sectionLabel: { fontSize: 16, fontWeight: '600' },
  helper: { fontSize: 14, lineHeight: 20 },
  swatchRow: { flexDirection: 'row', gap: SPACE.s2 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16, fontWeight: '500' },
  footer: { padding: SPACE.s3 },
});
