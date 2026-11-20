/**
 * LogControl — how a day gets logged, everywhere (D1).
 *
 * Not logged: two side-by-side soft-filled buttons, Done (ideal green, double
 * check) and Fallback (fallback blue, single check), plus a quiet "Skip today".
 * Both carry the same weight: both count.
 * Logged: a state chip; tapping it reopens the same choices.
 * "To do" is the resting state, never a button.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowRight, Check, CheckCheck, ChevronDown, LifeBuoy, Minus } from 'lucide-react-native';

import { FONT_SIZE, MIN_TAP_TARGET, mix, RADIUS, SPACE, useTheme, type Theme } from '@/theme';
import type { ChipState } from '@/types';
import type { IconComponent } from './icon';
import { Text } from '@/ui/AppText';

export interface StateVisual {
  readonly icon: IconComponent;
  readonly line: string;
  readonly deep: string;
  readonly soft: string;
  readonly doneLabel: string;
}

/** Colours, icon and label for a logged state. Shared with the Today card. */
export function logStateVisual(t: Theme, state: 'done' | 'fallback' | 'skip'): StateVisual {
  return visualFor(t, state);
}

function visualFor(t: Theme, state: 'done' | 'fallback' | 'skip'): StateVisual {
  if (state === 'done') return { icon: CheckCheck, line: t.color.ideal, deep: t.color.idealDeep, soft: t.color.idealSoft, doneLabel: 'Ideal done' };
  if (state === 'fallback') return { icon: Check, line: t.color.fallback, deep: t.color.fallbackDeep, soft: t.color.fallbackSoft, doneLabel: 'Fallback done' };
  return { icon: Minus, line: t.color.off, deep: t.color.offDeep, soft: t.color.offSoft, doneLabel: 'Skipped' };
}

export function isLogged(value: ChipState | null | undefined): value is 'done' | 'fallback' | 'skip' {
  return value === 'done' || value === 'fallback' || value === 'skip';
}

export interface LogStateChipProps {
  readonly value: 'done' | 'fallback' | 'skip';
  readonly onPress?: () => void;
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
  /** Override the chip text (e.g. "Taken" for a dose). */
  readonly label?: string;
  readonly testID?: string;
}

/** The chip a logged row shows. Tapping it reopens the choices. */
export function LogStateChip({ value, onPress, accessibilityLabel, disabled, label, testID }: LogStateChipProps) {
  const t = useTheme();
  const v = visualFor(t, value);
  const Icon = v.icon;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}, ${v.doneLabel}. Change`}
      testID={testID}
      hitSlop={6}
      style={[styles.chip, { backgroundColor: v.soft }]}
    >
      <Icon size={16} color={v.deep} />
      <Text style={[styles.chipLabel, { color: v.deep }]}>{label ?? v.doneLabel}</Text>
      {onPress ? <ChevronDown size={14} color={v.deep} /> : null}
    </Pressable>
  );
}

export interface LogButtonsProps {
  readonly value: ChipState | null;
  readonly onChange: (state: ChipState) => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel: string;
  /** One-line plan shown under each button label, so the choice explains itself. */
  readonly idealHint?: string | null;
  readonly fallbackHint?: string | null;
  /** Hide the Fallback button for tasks with no fallback defined. */
  readonly hideFallback?: boolean;
  /** When given, a "Push to tomorrow" link sits under the buttons while nothing is logged. */
  readonly onPush?: () => void;
  /** When given, an "Emergency day off" link sits opposite it while nothing is logged. */
  readonly onEmergency?: () => void;
  readonly testID?: string;
}

/**
 * The Done / Fallback pair, and under it the quiet links: "Push to tomorrow" and "Emergency day
 * off" while nothing is logged, "Clear log" once something is. There is no Skip: a day not done
 * already counts as missed, and a day that truly can't happen is an emergency day off.
 */
export function LogButtons({ value, onChange, disabled = false, accessibilityLabel, idealHint, fallbackHint, hideFallback = false, onPush, onEmergency, testID }: LogButtonsProps) {
  const t = useTheme();
  const logged = isLogged(value);
  const renderButton = (state: 'done' | 'fallback', label: string, hint?: string | null) => {
    const v = visualFor(t, state);
    const Icon = v.icon;
    const selected = value === state;
    return (
      <Pressable
        key={state}
        onPress={disabled ? undefined : () => onChange(state)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={`${accessibilityLabel}: ${label}`}
        style={({ pressed }) => [
          styles.button,
          { borderColor: selected ? v.line : v.soft, borderBottomColor: selected ? v.line : t.scheme === 'dark' ? mix(v.soft, '#000000', 0.42) : mix(v.soft, v.deep, 0.16), backgroundColor: selected ? t.color.bgAlt : v.soft },
          pressed && styles.buttonPressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.buttonHead}>
          <Icon size={18} color={v.deep} />
          <Text style={[styles.buttonLabel, { color: v.deep }]}>{label}</Text>
        </View>
        {hint ? (
          <Text numberOfLines={2} style={[styles.buttonHint, { color: v.deep }]}>
            {hint}
          </Text>
        ) : null}
      </Pressable>
    );
  };
  return (
    <View style={styles.buttonsRoot} testID={testID} accessibilityLabel={accessibilityLabel}>
      <View style={styles.buttonsRow}>
        {renderButton('done', 'Done', idealHint)}
        {hideFallback ? null : renderButton('fallback', 'Fallback', fallbackHint)}
      </View>
      {!logged && !onPush && !onEmergency ? null : (
        <View style={styles.quietRow}>
          {!logged && onPush ? (
            <Pressable
              onPress={disabled ? undefined : onPush}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${accessibilityLabel}: Push to tomorrow`}
              hitSlop={8}
              style={[styles.quiet, styles.quietIconRow]}
            >
              <ArrowRight size={14} color={t.color.textMuted} />
              <Text style={[styles.quietLabel, { color: t.color.textMuted, fontWeight: '500' }]}>Push to tomorrow</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {!logged && onEmergency ? (
            <Pressable
              onPress={disabled ? undefined : onEmergency}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${accessibilityLabel}: Emergency day off. Today won't count for or against you.`}
              hitSlop={8}
              style={[styles.quiet, styles.quietIconRow]}
            >
              <LifeBuoy size={14} color={t.color.textMuted} />
              <Text style={[styles.quietLabel, { color: t.color.textMuted, fontWeight: '500' }]}>Emergency day off</Text>
            </Pressable>
          ) : null}
          {logged ? (
            <Pressable
              onPress={disabled ? undefined : () => onChange('todo')}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${accessibilityLabel}: Clear log`}
              hitSlop={8}
              style={styles.quiet}
            >
              <Text style={[styles.quietLabel, { color: t.color.textMuted }]}>Clear log</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

export interface LogControlProps extends LogButtonsProps {
  /** Optional label on the left, e.g. "Dose 1". */
  readonly label?: string;
  readonly caption?: string;
  /** Override the logged chip text. */
  readonly loggedLabel?: string;
}

/** Label + chip when logged, buttons when not (task screen, doses, previews). */
export function LogControl({ label, caption, value, onChange, disabled, accessibilityLabel, idealHint, fallbackHint, hideFallback, onPush, onEmergency, loggedLabel, testID }: LogControlProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const logged = isLogged(value);
  const showButtons = !logged || open;
  return (
    <View style={styles.controlRoot} testID={testID}>
      {label || logged ? (
        <View style={styles.controlHeader}>
          <View style={styles.controlLabelCol}>
            {label ? <Text style={[styles.controlLabel, { color: t.color.text }]}>{label}</Text> : null}
            {caption ? <Text style={[styles.controlCaption, { color: t.color.textMuted }]}>{caption}</Text> : null}
          </View>
          {logged ? <LogStateChip value={value} onPress={() => setOpen((v) => !v)} accessibilityLabel={accessibilityLabel} disabled={disabled} label={loggedLabel} /> : null}
        </View>
      ) : null}
      {showButtons ? (
        <LogButtons
          value={value}
          onChange={(s) => {
            setOpen(false);
            onChange(s);
          }}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel}
          idealHint={idealHint}
          fallbackHint={fallbackHint}
          hideFallback={hideFallback}
          onPush={onPush}
          onEmergency={onEmergency}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s1,
    borderRadius: RADIUS.pill,
    paddingVertical: 6,
    paddingHorizontal: SPACE.s2 + 2,
    minHeight: 32,
  },
  chipLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  buttonsRoot: { gap: SPACE.s1 },
  buttonsRow: { flexDirection: 'row', gap: SPACE.s2 },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: MIN_TAP_TARGET + 4,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.s2,
    paddingVertical: SPACE.s1 + 2,
  },
  buttonPressed: { borderBottomWidth: 2, marginTop: 3 },
  buttonHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 + 2 },
  buttonHint: { fontSize: FONT_SIZE.xs, maxWidth: '100%' },
  buttonLabel: { fontSize: FONT_SIZE.base, fontWeight: '800' },
  quietRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quiet: { minHeight: 28, justifyContent: 'center', paddingHorizontal: SPACE.s1 },
  quietLabel: { fontSize: FONT_SIZE.sm },
  quietIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  disabled: { opacity: 0.5 },
  controlRoot: { gap: SPACE.s2 },
  controlHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2 },
  controlLabelCol: { flexShrink: 1, gap: 2 },
  controlLabel: { fontSize: FONT_SIZE.base, fontWeight: '600' },
  controlCaption: { fontSize: FONT_SIZE.sm },
});
