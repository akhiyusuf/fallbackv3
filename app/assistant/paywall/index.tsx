/**
 * S38 — Paywall    route: /assistant/paywall
 * Owner: M6. Features: F16, F17, F18.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S38)
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Sparkles } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';

import { AssistantHeader } from '@/features/assistant/AssistantHeader';
import { S38_COPY } from '@/features/assistant/copy';
import { billing } from '@/services/billing';
import { SPACE, useTheme } from '@/theme';
import { Badge, Button, Card, InlineRetryBanner, Skeleton } from '@/ui';
import { useToastStore } from '@/app-shell';

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

  function handleBack() {
    router.replace('/assistant' as Href);
  }

  async function handleRestore() {
    setRestoring(true);
    const result = await billing.restore();
    setRestoring(false);
    if (result.ok && result.value) {
      router.replace('/assistant/chat' as Href);
      return;
    }
    showToast(S38_COPY.restoreNoneFound, 'neutral');
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <AssistantHeader onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.eyebrowRow}>
          <Sparkles size={14} color={t.accent.base} />
          <Text style={[styles.eyebrow, { color: t.color.textMuted }]}>{S38_COPY.eyebrow}</Text>
        </View>

        {storeUnreachable ? (
          <InlineRetryBanner message={S38_COPY.storeUnreachable} onRetry={checkStore} retryLabel={S38_COPY.retry} tone="warning" />
        ) : null}

        {loading ? (
          <>
            <Skeleton width={40} height={40} radius={20} />
            <Skeleton width="80%" height={28} />
            <Skeleton height={140} />
            <Skeleton height={140} />
          </>
        ) : (
          <>
            <Sparkles size={32} color={t.accent.base} accessibilityElementsHidden importantForAccessibility="no" />
            <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
              {S38_COPY.headline}
            </Text>
            <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S38_COPY.subcopy}</Text>

            <View style={styles.bullets}>
              {S38_COPY.bullets.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <CheckCircle2 size={16} color={t.color.ideal} />
                  <Text style={[styles.bulletText, { color: t.color.text }]}>{b}</Text>
                </View>
              ))}
            </View>

            {/* Card A — Subscribe */}
            <Card accessibilityLabel="Subscribe to Fallback AI" accessibilityRole="summary">
              <Text style={[styles.cardEyebrow, { color: t.accent.deep }]}>{S38_COPY.cardA.eyebrow}</Text>
              <Text style={[styles.cardHeading, { color: t.color.text }]}>{S38_COPY.cardA.heading}</Text>
              <Text style={[styles.price, { color: t.color.text }]}>{S38_COPY.cardA.price}</Text>
              <Text style={[styles.priceSecondary, { color: t.color.textMuted }]}>{S38_COPY.cardA.priceSecondary}</Text>
              <Badge label={S38_COPY.cardA.badge} tone="accent" />
              <Button
                label={S38_COPY.cardA.cta}
                onPress={() => router.push('/assistant/paywall/plan' as Href)}
                variant="primary"
                disabled={storeUnreachable}
                accessibilityLabel={S38_COPY.cardA.cta}
                fullWidth
              />
              <Text style={[styles.finePrint, { color: t.color.textDim }]}>
                {storeUnreachable ? S38_COPY.storeUnavailableFinePrint : S38_COPY.cardA.finePrint}
              </Text>
              <Button
                label={S38_COPY.cardA.restorePurchases}
                onPress={handleRestore}
                variant="ghost"
                loading={restoring}
                accessibilityLabel={S38_COPY.cardA.restorePurchases}
              />
            </Card>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: t.color.border }]} />
              <Text style={[styles.dividerLabel, { color: t.color.textDim }]}>{S38_COPY.divider}</Text>
              <View style={[styles.dividerLine, { backgroundColor: t.color.border }]} />
            </View>

            {/* Card B — Bring your own key. Structurally identical to Card A; never disabled by store outages. */}
            <Card accessibilityLabel="Use your own AI key" accessibilityRole="summary">
              <Text style={[styles.cardEyebrow, { color: t.color.textMuted }]}>{S38_COPY.cardB.eyebrow}</Text>
              <Text style={[styles.cardHeading, { color: t.color.text }]}>{S38_COPY.cardB.heading}</Text>
              <Text style={[styles.description, { color: t.color.textMuted }]}>{S38_COPY.cardB.description}</Text>
              <View style={styles.bullets}>
                {S38_COPY.cardB.bullets.map((b) => (
                  <View key={b} style={styles.bulletRow}>
                    <CheckCircle2 size={16} color={t.color.ideal} />
                    <Text style={[styles.bulletText, { color: t.color.text }]}>{b}</Text>
                  </View>
                ))}
              </View>
              <Button
                label={S38_COPY.cardB.cta}
                onPress={() => router.push('/assistant/paywall/byo' as Href)}
                variant="secondary"
                accessibilityLabel={S38_COPY.cardB.cta}
                fullWidth
                testID="s38-byo-cta"
              />
              <Text style={[styles.finePrint, { color: t.color.textDim }]}>{S38_COPY.cardB.finePrint}</Text>
            </Card>

            <Text style={[styles.footerDisclosure, { color: t.color.textDim }]}>{S38_COPY.footerDisclosure}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  headline: { fontSize: 24, fontWeight: '800', lineHeight: 30 },
  subcopy: { fontSize: 15, lineHeight: 22 },
  bullets: { gap: SPACE.s1 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  bulletText: { fontSize: 14, flexShrink: 1 },
  cardEyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  cardHeading: { fontSize: 18, fontWeight: '700' },
  price: { fontSize: 22, fontWeight: '800' },
  priceSecondary: { fontSize: 13 },
  description: { fontSize: 14, lineHeight: 20 },
  finePrint: { fontSize: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  dividerLine: { flex: 1, height: 1 },
  dividerLabel: { fontSize: 12, fontWeight: '600' },
  footerDisclosure: { fontSize: 12, lineHeight: 18, textAlign: 'center', paddingTop: SPACE.s2 },
});
