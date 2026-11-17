/** S06 — onboarding step 5. Accent swatches and one reminders row; no dead "Preview" button. */
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Check, Palette } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeStore, useToastStore } from '@/app-shell';
import { useSettings, useUpdateSettings } from '@/queries';
import { DEFAULT_ACCENT, FONT_SIZE, RADIUS, SPACE, THEME_LABELS, THEME_ORDER, THEME_SEEDS, useTheme } from '@/theme';
import { Radio, SectionHeading } from '@/ui';
import type { AccentKey, ThemeMode } from '@/types';

import { S06_COPY } from './copy';
import { OnboardingShell } from './OnboardingShell';
import { useOnboardingStepMarker } from './useOnboardingResume';
import { Text } from '@/ui/AppText';

const ACCENT_ORDER: readonly AccentKey[] = THEME_ORDER;
const ACCENT_LABEL: Record<string, string> = THEME_LABELS;

export function PersonalizeScreen() {
  const t = useTheme();
  const router = useRouter();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  useOnboardingStepMarker('/onboarding/personalize');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) setAccent(settingsQuery.data.accent);
  }, [settingsQuery.data?.accent]);

  async function handleNext() {
    const priorAccent = settingsQuery.data?.accent ?? DEFAULT_ACCENT;
    const priorMode = settingsQuery.data?.theme ?? 'auto';
    setSaving(true);
    // A thrown write must reach the calm retry toast too, or the Next button would spin for ever.
    const result = await updateSettings.mutateAsync({ accent, theme: mode }).catch(() => ({ ok: false as const }));
    setSaving(false);
    if (!result.ok) {
      setAccent(priorAccent);
      setMode(priorMode);
      showToast(S06_COPY.saveFailure, 'warning');
      return;
    }
    // Reminders are asked about once, on the next step. This step is only the colour.
    router.push('/onboarding/notifications-primer' as Href);
  }

  return (
    <OnboardingShell step={5} icon={Palette} headline={S06_COPY.headline} body={S06_COPY.body} onNext={() => void handleNext()} nextLoading={saving}>
      <View style={styles.section}>
        <SectionHeading>{S06_COPY.accentSectionLabel}</SectionHeading>
        <View style={styles.swatchRow} accessibilityRole="radiogroup" accessibilityLabel={S06_COPY.accentSectionLabel}>
          {ACCENT_ORDER.map((key) => {
            const selected = accent === key;
            return (
              <Pressable
                key={key}
                onPress={() => setAccent(key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${ACCENT_LABEL[key]}${selected ? ', selected' : ''}`}
                style={[styles.swatch, { backgroundColor: THEME_SEEDS[key as keyof typeof THEME_SEEDS] }, key === 'mono' && { borderWidth: 2, borderColor: t.color.borderStrong }]}
              >
                {key === 'mono' ? <View style={styles.monoHalf} /> : null}
                {selected ? <Check size={20} color={key === 'mono' ? '#8a8a8a' : t.color.textOnAccent} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.helper, { color: t.color.textMuted }]}>{S06_COPY.accentHelper}</Text>
      </View>
      <View style={styles.section}>
        <SectionHeading>{S06_COPY.appearanceSectionLabel}</SectionHeading>
        <Radio label="" value={mode} options={S06_COPY.appearanceOptions} onChange={(v) => setMode(v as ThemeMode)} />
      </View>

    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.s2 + 4 },
  helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 + 4 },
  swatch: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  monoHalf: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', backgroundColor: '#ffffff' },
});
