/** S03 — Onboarding: Concept (ideal + fallback). route: /onboarding/concept. Features: F9, F2. */
import { useRouter, type Href } from 'expo-router';
import { CheckCircle2, CircleDashed, GitBranch, Lock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { now } from '@/lib/date';
import { useUpdateSettings } from '@/queries';
import { SPACE, useTheme } from '@/theme';
import { Card } from '@/ui';

import { S03_COPY } from './copy';
import { OnboardingShell } from './OnboardingShell';
import { finishOnboardingProgress, useOnboardingStepMarker } from './useOnboardingResume';

export function ConceptScreen() {
  const t = useTheme();
  const router = useRouter();
  const updateSettings = useUpdateSettings();
  useOnboardingStepMarker('/onboarding/concept');

  async function handleSkip() {
    void updateSettings.mutateAsync({ onboardingCompletedAt: now() });
    await finishOnboardingProgress();
    router.replace('/today' as Href);
  }

  function handleNext() {
    router.push('/onboarding/types' as Href);
  }

  return (
    <OnboardingShell step={2} icon={GitBranch} headline={S03_COPY.headline} body={S03_COPY.body} onNext={handleNext} onSkip={handleSkip}>
      <Card
        accessibilityLabel={`Example: Morning workout. Ideal: Full workout, 30 minutes, all 3 steps. Fallback: 10 pushups, the low bar on a hard day.`}
      >
        <Text style={[styles.eyebrow, { color: t.color.textDim }]}>{S03_COPY.eyebrow}</Text>
        <View style={styles.row}>
          <CheckCircle2 size={20} color={t.color.ideal} accessibilityElementsHidden importantForAccessibility="no" />
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: t.color.text }]}>{S03_COPY.idealLabel}</Text>
            <Text style={[styles.rowHelper, { color: t.color.textMuted }]}>{S03_COPY.idealHelper}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <CircleDashed size={20} color={t.color.fallback} accessibilityElementsHidden importantForAccessibility="no" />
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: t.color.text }]}>{S03_COPY.fallbackLabel}</Text>
            <Text style={[styles.rowHelper, { color: t.color.textMuted }]}>{S03_COPY.fallbackHelper}</Text>
          </View>
        </View>
      </Card>
      <View style={styles.privacyRow} accessibilityLabel={S03_COPY.privacy}>
        <Lock size={16} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.privacyText, { color: t.color.textMuted }]}>{S03_COPY.privacy}</Text>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s2 },
  rowText: { flexShrink: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowHelper: { fontSize: 13, lineHeight: 18 },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s2, marginTop: SPACE.s2 },
  privacyText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
});
