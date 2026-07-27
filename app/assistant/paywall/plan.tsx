/**
 * S39 — Choose Plan & Confirm    route: /assistant/paywall/plan
 * Owner: M6. Features: F17.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S39)
 */
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { AssistantHeader } from '@/features/assistant/AssistantHeader';
import { S39_COPY } from '@/features/assistant/copy';
import { billing } from '@/services/billing';
import { SPACE, useTheme } from '@/theme';
import { Badge, Button, Card, InlineRetryBanner } from '@/ui';

type Plan = 'annual' | 'monthly';

export default function S39ChoosePlanAndConfirm() {
  const t = useTheme();
  const router = useRouter();
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  const [plan, setPlan] = useState<Plan>('annual');
  const [verifying, setVerifying] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);
  const [purchaseError, setPurchaseError] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleBack() {
    router.replace((origin === 'manage' ? '/settings/subscription' : '/assistant/paywall') as Href);
  }

  async function handleConfirm() {
    setVerifying(true);
    setBiometricFailed(false);
    setPurchaseError(false);
    const result = await billing.purchase(plan);
    setVerifying(false);
    if (!result.ok) {
      if (result.error.code === 'CANCELLED') setBiometricFailed(true);
      else setPurchaseError(true);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.replace('/assistant/chat' as Href), 600);
  }

  const confirmLabel = Platform.OS === 'ios' ? S39_COPY.confirmIos : S39_COPY.confirmAndroid;
  const BiometricIcon = Platform.OS === 'ios' ? ScanFace : Fingerprint;

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <AssistantHeader onBack={handleBack} title={S39_COPY.title} />
      <View style={styles.content}>
        <PlanCard
          selected={plan === 'annual'}
          onPress={() => setPlan('annual')}
          title={S39_COPY.annual.title}
          price={S39_COPY.annual.price}
          billed={S39_COPY.annual.billed}
          badge={S39_COPY.annual.badge}
          strike={`${S39_COPY.annual.strikeFrom} → ${S39_COPY.annual.strikeTo}`}
          disabled={verifying}
        />
        <PlanCard
          selected={plan === 'monthly'}
          onPress={() => setPlan('monthly')}
          title={S39_COPY.monthly.title}
          price={S39_COPY.monthly.price}
          billed={S39_COPY.monthly.billed}
          disabled={verifying}
        />

        <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S39_COPY.subcopy}</Text>

        {biometricFailed ? (
          <InlineRetryBanner message={S39_COPY.biometricFailed} onRetry={handleConfirm} retryLabel="Try again" tone="warning" />
        ) : null}
        {purchaseError ? (
          <InlineRetryBanner message={S39_COPY.purchaseError} onRetry={handleConfirm} retryLabel={S39_COPY.retry} tone="warning" />
        ) : null}
        {success ? (
          <Text style={[styles.success, { color: t.color.idealDeep }]} accessibilityLiveRegion="polite">
            {S39_COPY.success}
          </Text>
        ) : null}

        <Button
          label={verifying ? S39_COPY.verifying : confirmLabel}
          onPress={handleConfirm}
          loading={verifying}
          icon={verifying ? undefined : <BiometricIcon size={18} color={t.color.textOnAccent} />}
          accessibilityLabel={confirmLabel}
          fullWidth
          testID="s39-confirm"
        />
        <Text style={[styles.finePrint, { color: t.color.textDim }]}>{S39_COPY.finePrint}</Text>
      </View>
    </View>
  );
}

function PlanCard({
  selected,
  onPress,
  title,
  price,
  billed,
  badge,
  strike,
  disabled,
}: {
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly title: string;
  readonly price: string;
  readonly billed: string;
  readonly badge?: string;
  readonly strike?: string;
  readonly disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Card
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${badge ? `, ${badge}` : ''}, ${price} ${billed}${selected ? ', selected' : ', not selected'}`}
    >
      <View style={styles.planRow}>
        <View style={[styles.radioDot, { borderColor: selected ? t.accent.base : t.color.border, backgroundColor: selected ? t.accent.base : 'transparent' }]} />
        <View style={styles.planText}>
          <View style={styles.planTitleRow}>
            <Text style={[styles.planTitle, { color: t.color.text }]}>{title}</Text>
            {badge ? <Badge label={badge} tone="accent" /> : null}
          </View>
          <Text style={[styles.planPrice, { color: t.color.text }]}>
            {price} <Text style={{ color: t.color.textMuted }}>{billed}</Text>
          </Text>
          {strike ? <Text style={[styles.strike, { color: t.color.textDim }]}>{strike}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s2 },
  subcopy: { fontSize: 14, textAlign: 'center' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  radioDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  planText: { flex: 1, gap: 2 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  planTitle: { fontSize: 16, fontWeight: '700' },
  planPrice: { fontSize: 15, fontWeight: '600' },
  strike: { fontSize: 12, textDecorationLine: 'line-through' },
  success: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  finePrint: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
