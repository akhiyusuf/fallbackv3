/**
 * S44 — Manage Subscription    route: /settings/subscription
 * Owner: M6. Features: F17.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S44)
 */
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { AssistantHeader } from '@/features/assistant/AssistantHeader';
import { S44_COPY } from '@/features/assistant/copy';
import { billing } from '@/services/billing';
import { useEntitlementStore } from '@/app-shell';
import { useToastStore } from '@/app-shell';
import { SPACE, useTheme } from '@/theme';
import { Badge, Button, Card, InlineRetryBanner, Skeleton } from '@/ui';

type Plan = 'monthly' | 'annual';

export default function S44ManageSubscription() {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const entitlement = useEntitlementStore((s) => s.entitlement);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('monthly');
  const [restoring, setRestoring] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    const result = await billing.refreshEntitlement();
    if (!result.ok) setError(true);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (entitlement.plan) setSelectedPlan(entitlement.plan);
  }, [entitlement.plan]);

  function handleBack() {
    router.replace('/settings' as Href);
  }

  function handleConfirmChange() {
    router.push('/assistant/paywall/plan?origin=manage' as Href);
  }

  function handleStartTrial() {
    router.push('/assistant/paywall/plan?origin=manage' as Href);
  }

  function handleManageInStore() {
    showToast(S44_COPY.opensAppStore, 'neutral');
  }

  async function handleRestore() {
    setRestoring(true);
    const result = await billing.restore();
    setRestoring(false);
    if (!result.ok) {
      showToast(S44_COPY.errorStore, 'warning');
      return;
    }
    showToast(result.value ? S44_COPY.restoreSuccess : S44_COPY.restoreNone, result.value ? 'success' : 'neutral');
  }

  const isSubscribed = entitlement.status === 'active' || entitlement.status === 'trial';
  const manageLabel = Platform.OS === 'ios' ? S44_COPY.manageIos : S44_COPY.manageAndroid;

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <AssistantHeader onBack={handleBack} title={S44_COPY.title} />
      <View style={styles.content}>
        {loading ? (
          <Skeleton height={100} />
        ) : error ? (
          <InlineRetryBanner message={S44_COPY.errorStore} onRetry={load} retryLabel="Retry" tone="warning" />
        ) : (
          <>
            <Card accessibilityLabel="Plan status">
              <Badge label={isSubscribed ? S44_COPY.activeBadge : S44_COPY.freeBadge} tone={isSubscribed ? 'accent' : 'neutral'} />
              {isSubscribed ? (
                <>
                  <Text style={[styles.planLine, { color: t.color.text }]}>
                    {entitlement.plan === 'annual' ? S44_COPY.planAnnual : S44_COPY.planMonthly}
                  </Text>
                  <Text style={[styles.renewLine, { color: t.color.textMuted }]}>
                    {entitlement.status === 'trial'
                      ? `${S44_COPY.trialEndsPrefix} 3 ${S44_COPY.trialSuffix}`
                      : `${S44_COPY.renewsPrefix} ${entitlement.renewsOn ?? '—'}`}
                  </Text>
                </>
              ) : (
                <Text style={[styles.renewLine, { color: t.color.textMuted }]}>{S44_COPY.freeFraming}</Text>
              )}
            </Card>

            {isSubscribed ? (
              <Card accessibilityLabel="Change plan">
                <View style={styles.segmentRow}>
                  <SegmentOption
                    label={S44_COPY.segmentMonthly}
                    selected={selectedPlan === 'monthly'}
                    onPress={() => setSelectedPlan('monthly')}
                  />
                  <SegmentOption
                    label={S44_COPY.segmentAnnual}
                    selected={selectedPlan === 'annual'}
                    onPress={() => setSelectedPlan('annual')}
                  />
                </View>
                <Button label={S44_COPY.confirmChange} onPress={handleConfirmChange} accessibilityLabel={S44_COPY.confirmChange} fullWidth />
              </Card>
            ) : (
              <Button label={S44_COPY.startFreeTrial} onPress={handleStartTrial} accessibilityLabel={S44_COPY.startFreeTrial} fullWidth />
            )}

            <Card accessibilityLabel="Cancel subscription">
              <Text style={[styles.cancelHeading, { color: t.color.text }]}>{S44_COPY.cancelHeading}</Text>
              <Button label={manageLabel} onPress={handleManageInStore} variant="secondary" accessibilityLabel={manageLabel} fullWidth />
              <Text style={[styles.helper, { color: t.color.textMuted }]}>{S44_COPY.manageHelper}</Text>
            </Card>

            <Card accessibilityLabel="Restore purchases">
              <Button label={S44_COPY.restore} onPress={handleRestore} loading={restoring} variant="ghost" accessibilityLabel={S44_COPY.restore} fullWidth />
              <Text style={[styles.helper, { color: t.color.textMuted }]}>{S44_COPY.restoreHelper}</Text>
            </Card>
          </>
        )}
      </View>
    </View>
  );
}

function SegmentOption({ label, selected, onPress }: { readonly label: string; readonly selected: boolean; readonly onPress: () => void }) {
  const t = useTheme();
  return (
    <Text
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[
        styles.segment,
        { borderColor: selected ? t.accent.base : t.color.border, backgroundColor: selected ? t.accent.soft : t.color.bg, color: selected ? t.accent.deep : t.color.text },
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s2 },
  planLine: { fontSize: 16, fontWeight: '700' },
  renewLine: { fontSize: 14 },
  segmentRow: { flexDirection: 'row', gap: SPACE.s1 },
  segment: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: SPACE.s1, paddingHorizontal: SPACE.s1, fontSize: 13, fontWeight: '600', textAlign: 'center', overflow: 'hidden' },
  cancelHeading: { fontSize: 16, fontWeight: '700' },
  helper: { fontSize: 13, lineHeight: 18 },
});
