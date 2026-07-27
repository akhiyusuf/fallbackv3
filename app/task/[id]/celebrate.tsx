/**
 * S24 — Completion Celebration (overlay)    route: /task/:id/celebrate
 * Owner: M4. Features: F3, F13.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S24)
 *
 * Route contract (M4-owned — the caller, S09/M3 or S20/this module, is responsible for
 * supplying these query params): `variant` ('ideal' | 'fallback'), `xp` (awarded amount,
 * verbatim from `useLogState`'s Result), `levelUp` ('1' when the same completion crossed a
 * level-up threshold), `badgeKey` (set when the completion instead unlocked a tenure
 * milestone badge, per `badgesUnlocked[0]` — mutually exclusive with `levelUp` in practice,
 * per SCHEMA/PRD's "true level-up OR milestone" framing), `from` (the ORIGIN-AWARE-BACK
 * origin of the screen that triggered the log — 'today' or 'manage' — reused for this
 * screen's own dismiss).
 *
 * Outbound handoff to S28 (M5's `/achievements/celebrate`, contract supplied by M5 directly
 * to this module): `?kind=level-up&xp=<postCrossingLifetimeXp>` or `?kind=tenure&badgeKey=<key>`.
 * `postCrossingLifetimeXp` is NOT part of `useLogState`'s Result (only `LevelInfo`, which
 * carries level/title/xpIntoLevel — not the lifetime total), so it is read fresh from
 * `useProgress()` here: the triggering mutation already invalidated `QUERY_KEYS.progress`
 * before this screen ever mounts (it is only reached after that mutation resolves), so this
 * read is already the post-crossing total, not a stale one.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CircleDashed } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Button } from '@/ui';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { useConsistency, useProgress } from '@/queries';
import type { Id } from '@/types';

export default function S24CompletionCelebration() {
  const t = useTheme();
  const router = useRouter();
  const { id, variant, xp, levelUp, badgeKey } = useLocalSearchParams<{
    id: string;
    variant?: string;
    xp?: string;
    levelUp?: string;
    badgeKey?: string;
    from?: string;
  }>();
  const dismiss = useOriginAwareBack(ROUTES.today);

  const isIdeal = variant !== 'fallback';
  const xpAmount = Number(xp ?? (isIdeal ? 10 : 6));
  const consistency = useConsistency({ scope: 'per-task', window: 'last-7', taskId: id as Id });
  const progress = useProgress();

  const headline = isIdeal ? 'Nice — ideal done!' : 'You showed up 💪';
  const body =
    consistency.data && consistency.data.denominator > 0
      ? isIdeal
        ? `That's ${consistency.data.numerator} of ${consistency.data.denominator} days you've shown up. Consistency looking strong.`
        : "Fallback counts. Your consistency holds — that's the win on a hard day."
      : isIdeal
        ? 'Consistency looking strong.'
        : "Fallback counts. Your consistency holds — that's the win on a hard day.";

  function onContinue() {
    if (levelUp === '1') {
      const postCrossingLifetimeXp = progress.data?.lifetimeXp ?? xpAmount;
      router.replace(`${ROUTES.achievementsCelebrate}?kind=level-up&xp=${postCrossingLifetimeXp}` as never);
      return;
    }
    if (badgeKey) {
      router.replace(`${ROUTES.achievementsCelebrate}?kind=tenure&badgeKey=${badgeKey}` as never);
      return;
    }
    dismiss();
  }

  const Icon = isIdeal ? Check : CircleDashed;

  return (
    <View style={[styles.overlay, { backgroundColor: t.color.bg }]} accessibilityViewIsModal accessibilityLabel={headline}>
      <View style={[styles.card, { backgroundColor: t.color.bgAlt, borderColor: t.color.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: isIdeal ? t.color.idealSoft : t.color.fallbackSoft }]}>
          <Icon size={32} color={isIdeal ? t.color.idealDeep : t.color.fallbackDeep} />
        </View>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {headline}
        </Text>
        <Text style={[styles.xpLine, { color: t.color.xp }]} accessibilityLabel={`Plus ${xpAmount} X P`}>
          +{xpAmount} XP
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{body}</Text>
        <Button label="Continue" onPress={onContinue} accessibilityLabel="Continue" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.s4 },
  card: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 16, padding: SPACE.s4, alignItems: 'center', gap: SPACE.s2 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  headline: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  xpLine: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  body: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
});
