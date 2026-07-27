/** S05 — Onboarding: Consistency, not perfection. route: /onboarding/consistency. Features: F9, F5. */
import { useRouter, type Href } from 'expo-router';
import { TrendingUp } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { now } from '@/lib/date';
import { useUpdateSettings } from '@/queries';
import { SPACE, useTheme } from '@/theme';

import { S05_COPY } from './copy';
import { OnboardingShell } from './OnboardingShell';
import { SampleBreakdownBar } from './SampleBreakdownBar';
import { finishOnboardingProgress, useOnboardingStepMarker } from './useOnboardingResume';

export function ConsistencyScreen() {
  const t = useTheme();
  const router = useRouter();
  const updateSettings = useUpdateSettings();
  useOnboardingStepMarker('/onboarding/consistency');

  async function handleSkip() {
    void updateSettings.mutateAsync({ onboardingCompletedAt: now() });
    await finishOnboardingProgress();
    router.replace('/today' as Href);
  }

  function handleNext() {
    router.push('/onboarding/personalize' as Href);
  }

  return (
    <OnboardingShell step={4} icon={TrendingUp} headline={S05_COPY.headline} body={S05_COPY.body} onNext={handleNext} onSkip={handleSkip}>
      <View
        style={styles.statBlock}
        accessibilityLabel={`Example: 83 percent, 5 of 6 days you showed up. Breakdown: ideal, fallback, off.`}
      >
        <Text style={[styles.eyebrow, { color: t.color.textDim }]}>{S05_COPY.eyebrow}</Text>
        <Text style={[styles.numeral, { color: t.color.text }]}>{S05_COPY.bigNumeral}</Text>
        <Text style={[styles.subLabel, { color: t.color.textMuted }]}>{S05_COPY.subLabel}</Text>
        <SampleBreakdownBar />
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  statBlock: { gap: SPACE.s2 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  numeral: { fontSize: 40, fontWeight: '800' },
  subLabel: { fontSize: 16 },
});
