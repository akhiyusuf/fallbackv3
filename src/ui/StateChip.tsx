/**
 * M0 kit — Fallback-custom `StateChip`. The single-select four-state control
 * (To do / Done / Fallback / Skip) that drives F3 logging on S09/S20.
 *
 * Rule 4 (no text on a signal fill, ever) — fixed defect, do not regress: each option's tap
 * target is always transparent; only the small icon-only pill inside it takes the signal
 * fill (and only when that option is selected), and the option's text label sits beside the
 * pill on the option's own neutral background, never inside the fill.
 *
 * Fill/glyph/label-colour map is the approved handoff's own `chip(state)` function
 * (`design-input/Fallback Handoff (standalone).html`, ~byte offset 1082599) — not derived
 * from ARCHITECTURE prose. Skip IS a filled state (the `--off` grey, `minus` glyph): §5's
 * "missed has no colour" sentence governs the unfilled bar remainder and the empty heatmap
 * cell, not this chip — the design reuses the existing `off` signal deliberately, it does
 * not invent a fifth hue. (REVIEW-M0.md item 1.)
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CheckCheck, Minus } from 'lucide-react-native';

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

interface ChipVisual {
  readonly bg: string;
  readonly border: string;
  readonly icon: IconComponent | null;
  readonly iconColor: string;
  readonly labelColor: string;
}

/** The approved `chip(state)` map, transcribed 1:1 — see the file header for the source offset. */
function chipVisual(t: Theme, state: ChipState): ChipVisual {
  switch (state) {
    case 'done':
      return { bg: t.color.ideal, border: t.color.ideal, icon: CheckCheck, iconColor: t.color.iconOnSignal, labelColor: t.color.idealDeep };
    case 'fallback':
      return { bg: t.color.fallback, border: t.color.fallback, icon: Check, iconColor: t.color.iconOnSignal, labelColor: t.color.fallbackDeep };
    case 'skip':
      return { bg: t.color.off, border: t.color.off, icon: Minus, iconColor: t.color.iconOnSignal, labelColor: t.color.offDeep };
    case 'todo':
    default:
      return { bg: 'transparent', border: t.color.borderStrong, icon: null, iconColor: 'transparent', labelColor: t.color.textMuted };
  }
}

export function StateChip({ value, onChange, disabled = false, accessibilityLabel, variant = 'picker', onPressCompact, testID }: StateChipProps) {
  const t = useTheme();

  if (variant === 'compact') {
    const current = value ?? 'todo';
    const visual = chipVisual(t, current);
    const Icon = visual.icon;
    return (
      <Pressable
        onPress={disabled ? undefined : onPressCompact}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}, ${OPTION_LABEL[current]}`}
        testID={testID}
        style={styles.compactRow}
      >
        <View
          style={[
            styles.pill,
            { backgroundColor: visual.bg, borderColor: visual.border, borderWidth: current === 'todo' ? 2 : 0 },
          ]}
        >
          {Icon ? <Icon size={16} color={visual.iconColor} /> : null}
        </View>
        <Text style={[styles.compactLabel, { color: visual.labelColor }]}>{OPTION_LABEL[current]}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} testID={testID}>
      {ORDER.map((state) => {
        const selected = value === state || (value === null && state === 'todo');
        const visual = chipVisual(t, state);
        const Icon = visual.icon;
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
            {selected ? (
              <View
                style={[styles.pill, { backgroundColor: visual.bg, borderColor: visual.border, borderWidth: state === 'todo' ? 2 : 0 }]}
              >
                {Icon ? <Icon size={16} color={visual.iconColor} /> : null}
              </View>
            ) : (
              <View style={[styles.pill, styles.unselectedPill, { borderColor: t.color.borderStrong }]} />
            )}
            <Text style={[styles.optionLabel, { color: selected ? visual.labelColor : t.color.textMuted }]}>{OPTION_LABEL[state]}</Text>
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
  unselectedPill: { backgroundColor: 'transparent', borderWidth: 2 },
  optionLabel: { fontSize: 14, fontWeight: '500' },
  compactLabel: { fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
