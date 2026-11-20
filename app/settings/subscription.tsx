/**
 * S44 — Subscription. Status as a grouped list (D7); plans use the shared plan
 * cards (D9). "Manage in the store" only appears when there is a subscription.
 */
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { deepLinkToSubscriptions } from 'expo-iap';
import { format } from 'date-fns';
import { ExternalLink, RotateCcw } from 'lucide-react-native';

import { S39_COPY, S44_COPY } from '@/features/assistant/copy';
import { PlanCard } from '@/features/assistant/PlanCard';
import { billing } from '@/services/billing';
import { useEntitlementStore, useToastStore } from '@/app-shell';
import { parseLocalDate, diffDays, today } from '@/lib/date';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Button, InlineRetryBanner, ListGroup, ListRow, Screen, SectionHeading, Skeleton } from '@/ui';
import { Text } from '@/ui/AppText';

type Plan = 'monthly' | 'annual';

export default function S44ManageSubscription() {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const entitlement = useEntitlementStore((s) => s.entitlement);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');
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
  }, []);

  useEffect(() => {
    if (entitlement.plan) setSelectedPlan(entitlement.plan);
  }, [entitlement.plan]);

  function handleBack() {
    router.replace('/settings' as Href);
  }

  function goToPlan() {
    router.push('/assistant/paywall/plan?origin=manage' as Href);
  }

  function handleManageInStore() {
    showToast(Platform.OS === 'ios' ? 'Opening the App Store…' : 'Opening Google Play…', 'neutral');
    void deepLinkToSubscriptions().catch(() => undefined);
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
  const planName = !isSubscribed ? 'Free plan' : entitlement.plan === 'annual' ? 'Annual' : 'Monthly';

  if (loading || error) {
    return (
      <Screen title="Subscription" onBack={handleBack}>
        {loading ? <Skeleton height={120} radius={16} /> : <InlineRetryBanner message={S44_COPY.errorStore} onRetry={load} retryLabel="Try again" tone="warning" />}
      </Screen>
    );
  }

  return (
    <Screen
      title="Subscription"
      onBack={handleBack}
      footer={
        isSubscribed ? (
          selectedPlan !== entitlement.plan ? <Button label={S44_COPY.confirmChange} onPress={goToPlan} accessibilityLabel={S44_COPY.confirmChange} fullWidth /> : undefined
        ) : (
          <Button label={S44_COPY.startFreeTrial} onPress={goToPlan} accessibilityLabel={S44_COPY.startFreeTrial} fullWidth />
        )
      }
    >
      <ListGroup footer={isSubscribed ? undefined : 'The free plan keeps every core feature. Fallback AI is optional.'}>
        <ListRow label="Fallback AI" value={isSubscribed ? (entitlement.status === 'trial' ? 'Free trial' : 'Active') : 'Not subscribed'} />
        <ListRow label="Plan" value={planName} />
        {isSubscribed ? (
          <ListRow
            label={entitlement.status === 'trial' ? 'Trial ends' : 'Renews'}
            value={entitlement.status === 'trial' ? trialLine(entitlement.trialEndsOn) : renewLine(entitlement.renewsOn)}
          />
        ) : null}
      </ListGroup>

      <View style={styles.block}>
        <SectionHeading>{isSubscribed ? 'Change plan' : 'Plans'}</SectionHeading>
        <PlanCard
          selected={selectedPlan === 'annual'}
          onPress={() => setSelectedPlan('annual')}
          title={S39_COPY.annual.title}
          price={S39_COPY.annual.price}
          billed={S39_COPY.annual.billed}
          badge="Save 33%"
          note={`${S39_COPY.annual.strikeTo}, instead of ${S39_COPY.annual.strikeFrom}`}
        />
        <PlanCard selected={selectedPlan === 'monthly'} onPress={() => setSelectedPlan('monthly')} title={S39_COPY.monthly.title} price={S39_COPY.monthly.price} billed={S39_COPY.monthly.billed} />
        {isSubscribed ? null : <Text style={[styles.helper, { color: t.color.textMuted }]}>{S39_COPY.subcopy}</Text>}
      </View>

      <ListGroup title="Billing" footer={isSubscribed ? S44_COPY.manageHelper : S44_COPY.restoreHelper}>
        {isSubscribed ? (
          <ListRow icon={ExternalLink} label={manageLabel} sublabel="Cancel or change billing there" onPress={handleManageInStore} chevron={false} />
        ) : null}
        <ListRow icon={RotateCcw} label={restoring ? 'Checking…' : S44_COPY.restore} onPress={() => void handleRestore()} disabled={restoring} chevron={false} />
      </ListGroup>
    </Screen>
  );
}

function trialLine(trialEndsOn: string | null): string {
  if (!trialEndsOn) return 'Active';
  const days = Math.max(0, diffDays(trialEndsOn as never, today()));
  return `In ${days} ${days === 1 ? 'day' : 'days'}`;
}

function renewLine(renewsOn: string | null): string {
  if (!renewsOn) return '–';
  return format(parseLocalDate(renewsOn as never), 'MMM d, yyyy');
}

const styles = StyleSheet.create({
  block: { gap: SPACE.s2 + 4 },
  helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
