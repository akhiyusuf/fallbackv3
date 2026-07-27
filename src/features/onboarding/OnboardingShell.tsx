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
  readonly icon: IconComponent;
  readonly headline: string;
  readonly body: string;
  readonly onNext: () => void;
  /** `undefined` => no Skip control (S06, the last pitch-tour screen). */
  readonly onSkip?: () => void;
  readonly nextLabel?: string;
  readonly nextDisabled?: boolean;
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
  children,
}: OnboardingShellProps) {
  const t = useTheme();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Step ${step} of ${TOTAL_STEPS}. ${headline}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
              style={[
                styles.dot,
                { backgroundColor: dot === step ? t.accent.base : t.color.border },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.content}>
        <Icon size={40} color={t.accent.base} accessibilityElementsHidden importantForAccessibility="no" />
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {headline}
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{body}</Text>
        {children}
      </View>

      <View style={styles.footer}>
        <Button label={nextLabel} onPress={onNext} disabled={nextDisabled} accessibilityLabel={nextLabel} fullWidth />
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
