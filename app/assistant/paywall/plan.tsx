/** S39 — Choose plan and confirm    route: /assistant/paywall/plan */
import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { S39_COPY } from '@/features/assistant/copy';
import { PlanCard } from '@/features/assistant/PlanCard';
import { billing } from '@/services/billing';
import { FONT_SIZE, useTheme } from '@/theme';
import { Button, InlineRetryBanner, Screen } from '@/ui';
import { Text } from '@/ui/AppText';

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

  async function handleConfirm() {
    setVerifying(true);
    setBiometricFailed(false);
    setPurchaseError(false);
    const result = await billing.purchase(plan);
    setVerifying(false);
    if (!result.ok) {
      // Closing the store's own sheet is the person changing their mind: no message. Only a failed identity check gets one.
      if (result.error.code === 'CANCELLED') setBiometricFailed(result.error.cause === 'biometric');
      else setPurchaseError(true);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.replace('/assistant/chat' as Href), 600);
  }

  const confirmLabel = Platform.OS === 'ios' ? S39_COPY.confirmIos : S39_COPY.confirmAndroid;
  const BiometricIcon = Platform.OS === 'ios' ? ScanFace : Fingerprint;

  return (
    <Screen
      title={S39_COPY.title}
      level="page"
      onBack={() => router.replace((origin === 'manage' ? '/settings/subscription' : '/assistant/paywall') as Href)}
      footer={
        <>
          <Button
            label={verifying ? S39_COPY.verifying : confirmLabel}
            onPress={handleConfirm}
            loading={verifying}
            icon={verifying ? undefined : <BiometricIcon size={18} color={t.accent.on} />}
            accessibilityLabel={confirmLabel}
            fullWidth
            testID="s39-confirm"
          />
          <Text style={[styles.finePrint, { color: t.color.textMuted }]}>{S39_COPY.finePrint}</Text>
        </>
      }
    >
      <PlanCard selected={plan === 'annual'} onPress={() => setPlan('annual')} title={S39_COPY.annual.title} price={S39_COPY.annual.price} billed={S39_COPY.annual.billed} badge={S39_COPY.annual.badge} note={S39_COPY.annual.note} disabled={verifying} />
      <PlanCard selected={plan === 'monthly'} onPress={() => setPlan('monthly')} title={S39_COPY.monthly.title} price={S39_COPY.monthly.price} billed={S39_COPY.monthly.billed} disabled={verifying} />

      <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S39_COPY.subcopy}</Text>

      {biometricFailed ? <InlineRetryBanner message={S39_COPY.biometricFailed} onRetry={handleConfirm} retryLabel="Try again" tone="warning" /> : null}
      {purchaseError ? <InlineRetryBanner message={S39_COPY.purchaseError} onRetry={handleConfirm} retryLabel={S39_COPY.retry} tone="warning" /> : null}
      {success ? (
        <Text style={[styles.success, { color: t.color.idealDeep }]} accessibilityLiveRegion="polite">
          {S39_COPY.success}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subcopy: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  success: { fontSize: FONT_SIZE.base, fontWeight: '600' },
  finePrint: { fontSize: FONT_SIZE.xs, lineHeight: 18, textAlign: 'center' },
});
