/**
 * M0 kit — Fallback-custom `StateChip`. The single-select four-state control
 * (To do / Done / Fallback / Skip) that drives F3 logging on S09/S20.
 *
 * Rule 4 (no text on a signal fill, ever) — fixed defect, do not regress: each option's tap
 * target is always transparent; only the small icon-only pill inside it takes the signal
 * fill (and only when that option is selected), and the option's text label sits beside the
 * pill on the option's own neutral background, never inside the fill.
 *
 * Missed (the Skip state's resolved outcome) has no signal colour of its own
 * (ARCHITECTURE §5 — "Missed has no colour"): its pill renders on a neutral surface fill
 * with a muted icon/border rather than one of the three signal hues, so a chosen "Skip"
 * never invents an unpinned fourth signal colour.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CircleDashed, X } from 'lucide-react-native';

import { MIN_TAP_TARGET, RADIUS, SPACE, useTheme, type Theme } from '@/theme';
import type { ChipState } from '@/types';

import type { IconComponent } from './icon';

export interface StateChipProps {
  readonly value: ChipState | null;
  readonly onChange: (state: ChipState) => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel: string;
  /** 'picker' shows all four options; 'compact' shows only the current selection and opens the picker on tap. */
  readonly variant?: 'picker' | 'compact';
  readonly onPressCompact?: () => void;
  readonly testID?: string;
}

const ORDER: readonly ChipState[] = ['todo', 'done', 'fallback', 'skip'];

const OPTION_LABEL: Record<ChipState, string> = { todo: 'To do', done: 'Done', fallback: 'Fallback', skip: 'Skip' };

function pillStyle(t: Theme, state: ChipState, selected: boolean): { bg: string; icon: IconComponent | null; iconColor: string; border: string } {
  if (!selected) {
    return { bg: 'transparent', icon: null, iconColor: t.color.textDim, border: t.color.border };
  }
  switch (state) {
    case 'done':
      return { bg: t.color.ideal, icon: Check, iconColor: t.color.iconOnSignal, border: t.color.ideal };
    case 'fallback':
      return { bg: t.color.fallback, icon: CircleDashed, iconColor: t.color.iconOnSignal, border: t.color.fallback };
    case 'skip':
      // Missed carries no signal colour (ARCHITECTURE §5) — neutral surface fill, muted icon.
      return { bg: t.color.surface, icon: X, iconColor: t.color.textMuted, border: t.color.borderStrong };
    case 'todo':
    default:
      return { bg: 'transparent', icon: null, iconColor: t.color.textDim, border: t.color.border };
  }
}

export function StateChip({ value, onChange, disabled = false, accessibilityLabel, variant = 'picker', onPressCompact, testID }: StateChipProps) {
  const t = useTheme();

  if (variant === 'compact') {
    const current = value ?? 'todo';
    const pill = pillStyle(t, current, true);
    const Icon = pill.icon;
    return (
      <Pressable
        onPress={disabled ? undefined : onPressCompact}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}, ${OPTION_LABEL[current]}`}
        testID={testID}
        style={styles.compactRow}
      >
        <View style={[styles.pill, { backgroundColor: pill.bg, borderColor: pill.border, borderWidth: pill.bg === 'transparent' ? 1 : 0 }]}>
          {Icon ? <Icon size={16} color={pill.iconColor} /> : null}
        </View>
        <Text style={[styles.compactLabel, { color: t.color.text }]}>{OPTION_LABEL[current]}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} testID={testID}>
      {ORDER.map((state) => {
        const selected = value === state || (value === null && state === 'todo');
        const pill = pillStyle(t, state, selected);
        const Icon = pill.icon;
        return (
          <Pressable
            key={state}
            onPress={disabled ? undefined : () => onChange(state)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={OPTION_LABEL[state]}
            style={[styles.option, disabled && styles.disabled]}
          >
            <View
              style={[styles.pill, { backgroundColor: pill.bg, borderColor: pill.border, borderWidth: pill.bg === 'transparent' ? 1 : 0 }]}
            >
              {Icon ? <Icon size={16} color={pill.iconColor} /> : null}
            </View>
            <Text style={[styles.optionLabel, { color: t.color.text }]}>{OPTION_LABEL[state]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s1,
    minHeight: MIN_TAP_TARGET,
    paddingVertical: SPACE.s1,
    paddingHorizontal: SPACE.s1,
  },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, minHeight: MIN_TAP_TARGET, paddingHorizontal: SPACE.s1 },
  pill: { width: 28, height: 28, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 14, fontWeight: '500' },
  compactLabel: { fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
