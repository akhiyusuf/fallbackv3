/** S38 — Paywall    route: /assistant/paywall */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CalendarRange, Check, KeyRound, Mic, PencilLine, RotateCcw } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';

import { S38_COPY, S44_COPY } from '@/features/assistant/copy';
import { billing } from '@/services/billing';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Button, Card, InlineRetryBanner, ListGroup, ListRow, Screen, Skeleton, tintedSurface, VoiceMark } from '@/ui';
import { useToastStore } from '@/app-shell';
import { Text } from '@/ui/AppText';

const BENEFIT_ICONS = [Mic, PencilLine, CalendarRange] as const;

export default function S38Paywall() {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const [loading, setLoading] = useState(true);
  const [storeUnreachable, setStoreUnreachable] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function checkStore() {
    setLoading(true);
    const result = await billing.getProducts();
    setStoreUnreachable(!result.ok);
    setLoading(false);
  }

  useEffect(() => {
    void checkStore();
  }, []);

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    const result = await billing.restore();
    setRestoring(false);
    if (result.ok && result.value) {
      router.replace('/assistant/chat' as Href);
      return;
    }
    // A store that cannot be reached is not the same as "nothing to restore".
    if (!result.ok) {
      showToast(S44_COPY.errorStore, 'warning');
      return;
    }
    showToast(S38_COPY.restoreNoneFound, 'neutral');
  }

  return (
    <Screen title={S38_COPY.title} level="page" onBack={() => router.replace('/assistant' as Href)}>
      {storeUnreachable ? <InlineRetryBanner message={S38_COPY.storeUnreachable} onRetry={checkStore} retryLabel={S38_COPY.retry} tone="warning" /> : null}

      {loading ? (
        <>
          <Skeleton height={150} radius={20} />
          <Skeleton height={190} radius={20} />
          <Skeleton height={200} radius={20} />
        </>
      ) : (
        <>
          {/* The same star-and-wave mark as the voice screen and the add sheet. */}
          <View style={styles.hero}>
            <View style={[styles.orb, { backgroundColor: t.accent.soft }]}>
              <VoiceMark size={84} />
            </View>
            <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
              {S38_COPY.headline}
            </Text>
            <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S38_COPY.subcopy}</Text>
          </View>

          <ListGroup>
            {S38_COPY.benefits.map((b, i) => (
              <ListRow key={b.title} icon={BENEFIT_ICONS[i]} label={b.title} sublabel={b.body} chevron={false} />
            ))}
          </ListGroup>

          {/* The plan: the one tinted block on the screen, price large, one button. */}
          <View accessible={false} style={[styles.plan, tintedSurface(t, t.accent.fill)]}>
            <View style={styles.planHead}>
              <Text style={[styles.planName, { color: t.color.text }]}>{S38_COPY.cardA.heading}</Text>
              <View style={[styles.trial, { backgroundColor: t.color.bgAlt }]}>
                <Text style={[styles.trialLabel, { color: t.accent.text }]}>{S38_COPY.cardA.badge}</Text>
              </View>
            </View>
            <View>
              <Text style={[styles.price, { color: t.color.text }]}>{S38_COPY.cardA.price}</Text>
              <Text style={[styles.note, { color: t.color.text }]}>{S38_COPY.cardA.priceSecondary}</Text>
            </View>
            <Button label={S38_COPY.cardA.cta} onPress={() => router.push('/assistant/paywall/plan' as Href)} disabled={storeUnreachable} accessibilityLabel={S38_COPY.cardA.cta} fullWidth />
            <Text style={[styles.finePrint, { color: t.color.text }]}>{storeUnreachable ? S38_COPY.storeUnavailableFinePrint : S38_COPY.cardA.finePrint}</Text>
          </View>

          <View style={styles.or} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.orLine, { backgroundColor: t.color.border }]} />
            <Text style={[styles.orLabel, { color: t.color.textMuted }]}>{S38_COPY.divider}</Text>
            <View style={[styles.orLine, { backgroundColor: t.color.border }]} />
          </View>

          <Card accessibilityLabel={S38_COPY.cardB.heading} style={styles.card}>
            <View style={styles.byoHead}>
              <View style={[styles.byoIcon, { backgroundColor: t.color.surface }]}>
                <KeyRound size={20} color={t.color.text} />
              </View>
              <Text style={[styles.planName, { color: t.color.text }]}>{S38_COPY.cardB.heading}</Text>
            </View>
            <Text style={[styles.note, { color: t.color.textMuted }]}>{S38_COPY.cardB.description}</Text>
            <View style={styles.bullets}>
              {S38_COPY.cardB.bullets.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <View style={[styles.tick, { backgroundColor: t.color.ideal }]}>
                    <Check size={12} color={t.color.iconOnSignal} />
                  </View>
                  <Text style={[styles.bulletText, { color: t.color.text }]}>{b}</Text>
                </View>
              ))}
            </View>
            <Button label={S38_COPY.cardB.cta} onPress={() => router.push('/assistant/paywall/byo' as Href)} variant="secondary" accessibilityLabel={S38_COPY.cardB.cta} fullWidth testID="s38-byo-cta" />
            <Text style={[styles.finePrint, { color: t.color.textMuted }]}>{S38_COPY.cardB.finePrint}</Text>
          </Card>

          <ListGroup footer={S38_COPY.footerDisclosure}>
            <ListRow icon={RotateCcw} label={S38_COPY.cardA.restorePurchases} sublabel={S38_COPY.cardA.restoreSub} onPress={() => void handleRestore()} chevron={false} disabled={restoring} />
          </ListGroup>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: SPACE.s2, paddingTop: SPACE.s1 },
  orb: { width: 124, height: 124, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.s1 },
  headline: { fontSize: FONT_SIZE.xl, fontWeight: '800', lineHeight: 30, textAlign: 'center' },
  subcopy: { fontSize: FONT_SIZE.base, lineHeight: 24, textAlign: 'center' },
  plan: { padding: SPACE.s3, gap: SPACE.s2 + 4 },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2 },
  planName: { fontSize: FONT_SIZE.base, fontWeight: '800', flexShrink: 1 },
  trial: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE.s2 + 2, paddingVertical: 4 },
  trialLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800' },
  price: { fontSize: FONT_SIZE.xxl, lineHeight: 38, fontWeight: '800', fontVariant: ['tabular-nums'] },
  note: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  finePrint: { fontSize: FONT_SIZE.xs, lineHeight: 18, textAlign: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4 },
  orLine: { flex: 1, height: 2, borderRadius: 1 },
  orLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  card: { gap: SPACE.s2 + 4 },
  byoHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4 },
  byoIcon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  bullets: { gap: SPACE.s2 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  tick: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bulletText: { fontSize: FONT_SIZE.sm, flexShrink: 1 },
});
