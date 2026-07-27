/**
 * M7. Shared onboarding shell, established on S02 and reused through S06 (ALLSCREENS_1.md
 * S02 "Contents": Skip control, 5-dot progress, decorative icon, headline, body, Next).
 * S07/S08 deliberately do NOT use this shell (their own specs call that out explicitly).
 */
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';
import { Button } from '@/ui';
import type { IconComponent } from '@/ui';

import { ONBOARDING_SHELL_COPY } from './copy';

export interface OnboardingShellProps {
  readonly step: 1 | 2 | 3 | 4 | 5;
  /** `undefined` => no decorative icon (S06 — spec's Contents list no icon for this screen). */
  readonly icon?: IconComponent;
  readonly headline: string;
  readonly body: string;
  readonly onNext: () => void;
  /** `undefined` => no Skip control (S06, the last pitch-tour screen). */
  readonly onSkip?: () => void;
  readonly nextLabel?: string;
  readonly nextDisabled?: boolean;
  readonly nextLoading?: boolean;
  /**
   * S06 (review pass 1, blocking item 5): the last pitch-tour screen renders ALL 5 dots as
   * complete/filled, and the a11y announcement reads the literal "Step 5 of 5." — not the
   * per-step "Step N of 5. <headline>" every other S02–S05 screen announces.
   */
  readonly allStepsComplete?: boolean;
  readonly children?: ReactNode;
}

const TOTAL_STEPS = 5;

export function OnboardingShell({
  step,
  icon: Icon,
  headline,
  body,
  onNext,
  onSkip,
  nextLabel = ONBOARDING_SHELL_COPY.next,
  nextDisabled = false,
  nextLoading = false,
  allStepsComplete = false,
  children,
}: OnboardingShellProps) {
  const t = useTheme();

  useEffect(() => {
    const message = allStepsComplete ? `Step ${TOTAL_STEPS} of ${TOTAL_STEPS}.` : `Step ${step} of ${TOTAL_STEPS}. ${headline}`;
    AccessibilityInfo.announceForAccessibility?.(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, allStepsComplete]);

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View style={styles.header}>
        {onSkip ? (
          <Button label={ONBOARDING_SHELL_COPY.skip} onPress={onSkip} variant="ghost" accessibilityLabel="Skip onboarding" />
        ) : (
          <View />
        )}
        <View
          style={styles.dots}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((dot) => (
            <View
              key={dot}
              testID={`onboarding-dot-${dot}`}
              style={[
                styles.dot,
                { backgroundColor: allStepsComplete || dot === step ? t.accent.base : t.color.border },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {Icon ? <Icon size={40} color={t.accent.base} accessibilityElementsHidden importantForAccessibility="no" /> : null}
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {headline}
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{body}</Text>
        {children}
      </View>

      <View style={styles.footer}>
        <Button label={nextLabel} onPress={onNext} disabled={nextDisabled} loading={nextLoading} accessibilityLabel={nextLabel} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE.s3 },
  dots: { flexDirection: 'row', gap: SPACE.s1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { flex: 1, padding: SPACE.s3, gap: SPACE.s2 },
  headline: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
  footer: { padding: SPACE.s3 },
});
