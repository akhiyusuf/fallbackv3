/**
 * S28 — Level-Up Celebration    route: /achievements/celebrate
 * Owner: M5. Features: F13, F29.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S28)
 *
 * Route contract (M5-defined — not documented elsewhere; see build report):
 *   /achievements/celebrate?kind=level-up&xp=<lifetimeXpAfterCrossing>
 *   /achievements/celebrate?kind=tenure&badgeKey=<AchievementDef.key>
 * `xp` is the caller's (M4's S24, via useLogState's `levelUp`) POST-crossing lifetime XP —
 * this screen calls `levelFor(xp).title` itself, which is the ONE source of a level title
 * (never a hardcoded string). If `xp` is missing (a cold/direct visit), it falls back to
 * `useProgress()`'s current lifetime XP so the screen never crashes, but the title is still
 * always derived, never literal.
 *
 * This is the ONLY confetti surface in the app (MODULES.md) — fires once, only for a genuine
 * level-up or milestone tenure unlock. Locked badges never appear here.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS, levelFor } from '@/domain';
import { ROUTES } from '@/navigation';
import { useProgress } from '@/queries';
import { SCRIM, SPACE, useTheme } from '@/theme';
import { Button, MilestoneBadge } from '@/ui';

import { BADGE_ICONS, LEVEL_UP_ICON } from '@/features/progress/badgeIcons';
import { Confetti } from '@/features/progress/Confetti';
import { S28_COPY, tenureBodyFor } from '@/features/progress/copy';

export default function S28LevelUpCelebration() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; xp?: string; badgeKey?: string }>();
  const progressQuery = useProgress();

  const kind = params.kind === 'tenure' ? 'tenure' : 'level-up';

  function handleDismiss() {
    router.replace(ROUTES.achievements);
  }

  if (kind === 'tenure') {
    const badgeKey = params.badgeKey;
    const def = ACHIEVEMENTS.find((a) => a.key === badgeKey);
    const label = def?.label ?? '';
    const Icon = (badgeKey && BADGE_ICONS[badgeKey]) || LEVEL_UP_ICON;

    return (
      <View style={[styles.root, { backgroundColor: SCRIM }]} accessibilityViewIsModal>
        <Confetti />
        <View style={[styles.card, { backgroundColor: t.color.bgAlt, borderColor: t.color.border }]}>
          <MilestoneBadge label={label} earned icon={Icon} />
          <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
            {S28_COPY.tenureHeadline(label)}
          </Text>
          <Text style={[styles.body, { color: t.color.textMuted }]}>{tenureBodyFor(badgeKey)}</Text>
          <Button label={S28_COPY.dismissButton} onPress={handleDismiss} accessibilityLabel={S28_COPY.dismissButton} fullWidth />
        </View>
      </View>
    );
  }

  const xpParam = params.xp ? Number(params.xp) : NaN;
  const xp = Number.isFinite(xpParam) ? xpParam : (progressQuery.data?.lifetimeXp ?? 0);
  // ONE source of truth for a level title — never a literal string (MODULES.md non-negotiable).
  const level = levelFor(xp);

  return (
    <View style={[styles.root, { backgroundColor: SCRIM }]} accessibilityViewIsModal>
      <Confetti />
      <View style={[styles.card, { backgroundColor: t.color.bgAlt, borderColor: t.color.border }]}>
        <MilestoneBadge label={`Level ${level.level}`} earned icon={LEVEL_UP_ICON} />
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {S28_COPY.levelUpHeadline(level.level)}
        </Text>
        <Text style={[styles.subhead, { color: t.color.text }]}>{S28_COPY.levelUpSubhead(level.title)}</Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{S28_COPY.levelUpBody(level.level)}</Text>
        <Text style={[styles.forward, { color: t.color.textMuted }]}>{S28_COPY.forwardLine}</Text>
        <Button label={S28_COPY.dismissButton} onPress={handleDismiss} accessibilityLabel={S28_COPY.dismissButton} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.s4 },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 20, padding: SPACE.s4, gap: SPACE.s2, alignItems: 'center' },
  headline: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subhead: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  forward: { fontSize: 13, textAlign: 'center' },
});
