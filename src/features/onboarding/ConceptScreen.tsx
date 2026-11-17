/** S03 — onboarding step 1 (it leads the tour: the idea first, then the reason for it). The example uses the real task-card pieces so it matches the app. */
import { useRouter, type Href } from 'expo-router';
import { Dumbbell, GitBranch, Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { MetaLine, PlanTiles } from '@/features/task/TaskDetails';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Card, TaskIcon } from '@/ui';

import { S03_COPY } from './copy';
import { OnboardingShell, useOnboardingDensity } from './OnboardingShell';
import { useOnboardingResumeRedirect } from './useOnboardingResume';
import { Text } from '@/ui/AppText';

export function ConceptScreen() {
  const t = useTheme();
  const router = useRouter();
  const tight = useOnboardingDensity() === 'tight';
  // The first step is the one that reads the saved place back and forwards a returning person.
  const { resuming } = useOnboardingResumeRedirect('/onboarding/concept');
  if (resuming) return <View accessibilityLabel="Loading" />;

  return (
    <OnboardingShell step={1} icon={GitBranch} headline={S03_COPY.headline} body={S03_COPY.body} onNext={() => router.push('/onboarding/hook' as Href)}>
      <Card accessibilityLabel="Example: Morning workout. Ideal: full workout, 30 minutes. Fallback: 10 pushups." style={[styles.card, tight && styles.cardTight]}>
        <View style={styles.head}>
          <TaskIcon icon={Dumbbell} />
          <View style={styles.text}>
            <Text style={[styles.name, { color: t.color.text }]}>{S03_COPY.exampleName}</Text>
            <MetaLine parts={['Daily', 'High importance']} />
          </View>
        </View>
        <PlanTiles ideal={S03_COPY.idealText} fallback={S03_COPY.fallbackText} numberOfLines={2} />
      </Card>
      <View style={styles.privacyRow} accessibilityLabel={S03_COPY.privacy}>
        <Lock size={16} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.privacyText, tight && styles.privacyTight, { color: t.color.textMuted }]}>{S03_COPY.privacy}</Text>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.s2 + 4 },
  cardTight: { gap: SPACE.s2, padding: SPACE.s2 + 4 },
  privacyTight: { fontSize: 13, lineHeight: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: FONT_SIZE.base, fontWeight: '600' },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s2 },
  privacyText: { fontSize: FONT_SIZE.sm, lineHeight: 20, flexShrink: 1 },
});
