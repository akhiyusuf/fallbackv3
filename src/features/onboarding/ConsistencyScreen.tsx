/** S05 — onboarding step 4. */
import { useRouter, type Href } from 'expo-router';
import { TrendingUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { StatusPill } from '@/features/task/TaskDetails';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Card } from '@/ui';

import { S05_COPY } from './copy';
import { OnboardingShell } from './OnboardingShell';
import { SampleBreakdownBar } from './SampleBreakdownBar';
import { useOnboardingStepMarker } from './useOnboardingResume';
import { Text } from '@/ui/AppText';

export function ConsistencyScreen() {
  const t = useTheme();
  const router = useRouter();
  useOnboardingStepMarker('/onboarding/consistency');

  return (
    <OnboardingShell step={4} icon={TrendingUp} headline={S05_COPY.headline} body={S05_COPY.body} onNext={() => router.push('/onboarding/personalize' as Href)}>
      <Card accessibilityLabel="Example: 86 percent, 6 of 7 days you showed up. Four ideal days and two fallback days." style={styles.card}>
        <View style={styles.head}>
          <Text style={[styles.numeral, { color: t.color.text }]}>{S05_COPY.bigNumeral}</Text>
          <StatusPill label="Example" />
        </View>
        <Text style={[styles.subLabel, { color: t.color.textMuted }]}>{S05_COPY.subLabel}</Text>
        <SampleBreakdownBar />
      </Card>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.s2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numeral: { fontSize: FONT_SIZE.xxxl, fontWeight: '700', fontVariant: ['tabular-nums'] },
  subLabel: { fontSize: FONT_SIZE.base },
});
