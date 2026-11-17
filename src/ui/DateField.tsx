/**
 * DateField / TimeField — tappable fields that open the phone's own picker
 * (D12). They show "Mon, Nov 16" and "7:00 PM"; nobody types a raw date.
 *
 * Values stay in the app's storage formats: LocalDate `YYYY-MM-DD` and `HH:mm`.
 * Web renders a transparent native <input> over the field so the browser's
 * picker opens; native builds swap that overlay for the platform picker.
 */
import { createElement, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { CalendarDays, Clock } from 'lucide-react-native';
import { format } from 'date-fns';

import { FONT_SIZE, MIN_TAP_TARGET, RADIUS, SPACE, useTheme } from '@/theme';
import { Text, TextInput } from '@/ui/AppText';

const STYLE_ID = 'fb-native-picker-style';
function ensurePickerStyle() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  // Stretch the browser's picker affordance over the whole field so a tap anywhere opens it.
  el.textContent =
    '.fb-native-picker{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;margin:0;padding:0;font-size:16px;-webkit-appearance:none;appearance:none}' +
    '.fb-native-picker::-webkit-calendar-picker-indicator{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;cursor:pointer}';
  document.head.appendChild(el);
}

export function formatDateValue(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? '' : format(d, 'EEE, MMM d') + (d.getFullYear() !== new Date().getFullYear() ? `, ${d.getFullYear()}` : '');
}

export function formatTimeValue(value: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return '';
  const h = Number(m[1]);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m[2]} ${period}`;
}

interface PickerFieldProps {
  readonly kind: 'date' | 'time';
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly helper?: string;
  readonly error?: string;
  readonly min?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

function PickerField({ kind, label, value, onChange, placeholder, helper, error, min, accessibilityLabel, testID }: PickerFieldProps) {
  const t = useTheme();
  useEffect(ensurePickerStyle, []);
  const shown = kind === 'date' ? formatDateValue(value) : formatTimeValue(value);
  const Icon = kind === 'date' ? CalendarDays : Clock;
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
      {Platform.OS === 'web' ? (
        <View style={[styles.field, { backgroundColor: t.color.bgAlt, borderColor: error ? t.color.danger : t.color.borderStrong }]} testID={testID}>
          <Icon size={18} color={t.color.textMuted} />
          <Text style={[styles.value, { color: shown ? t.color.text : t.color.textDim }]}>{shown || (placeholder ?? (kind === 'date' ? 'Pick a date' : 'Pick a time'))}</Text>
          {createElement('input', {
            type: kind,
            value,
            min,
            className: 'fb-native-picker',
            'aria-label': accessibilityLabel ?? label,
            onChange: (e: { target: { value: string } }) => onChange(e.target.value),
            onClick: (e: { currentTarget: { showPicker?: () => void } }) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                /* the browser opens its own picker on tap */
              }
            },
          })}
        </View>
      ) : (
        <View style={[styles.field, { backgroundColor: t.color.bgAlt, borderColor: error ? t.color.danger : t.color.borderStrong }]}>
          <Icon size={18} color={t.color.textMuted} />
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={t.color.textDim}
            accessibilityLabel={accessibilityLabel ?? label}
            testID={testID}
            style={[styles.value, { color: t.color.text }]}
          />
        </View>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.helper, { color: t.color.danger }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

export type DateFieldProps = Omit<PickerFieldProps, 'kind'>;
export function DateField(props: DateFieldProps) {
  return <PickerField kind="date" {...props} />;
}
export type TimeFieldProps = Omit<PickerFieldProps, 'kind' | 'min'>;
export function TimeField(props: TimeFieldProps) {
  return <PickerField kind="time" {...props} />;
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 + 2, flex: 1 },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  field: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    minHeight: MIN_TAP_TARGET + 4,
    paddingHorizontal: SPACE.s2 + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s2,
    overflow: 'hidden',
  },
  value: { fontSize: FONT_SIZE.base, flex: 1 },
  helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
