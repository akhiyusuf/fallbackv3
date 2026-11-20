/**
 * DateField / TimeField — tappable fields that open the phone's own picker
 * (D12). They show "Mon, Nov 16" and "7:00 PM"; nobody types a raw date.
 *
 * Values stay in the app's storage formats: LocalDate `YYYY-MM-DD` and `HH:mm`.
 * On a phone a tap opens the system picker: Android's own date or time dialog, and on iOS a
 * sheet with the wheel picker and a Done button. A time field is optional, so its picker also
 * offers Clear. Web renders a transparent native <input> over the field so the browser's
 * picker opens.
 */
import { createElement, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock } from 'lucide-react-native';
import { format } from 'date-fns';

import { FONT_SIZE, MIN_TAP_TARGET, RADIUS, SCRIM, SPACE, useTheme } from '@/theme';
import { Text } from '@/ui/AppText';

/** The stored value as a Date for the picker; today or now when nothing is chosen yet. */
function toPickerDate(kind: 'date' | 'time', value: string): Date {
  const d = new Date();
  if (kind === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}
function fromPickerDate(kind: 'date' | 'time', d: Date): string {
  return format(d, kind === 'date' ? 'yyyy-MM-dd' : 'HH:mm');
}

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
  const shownPlaceholder = placeholder ?? (kind === 'date' ? 'Pick a date' : 'Pick a time');
  const Icon = kind === 'date' ? CalendarDays : Clock;
  const [open, setOpen] = useState(false);
  // iOS only: the wheel's position while the sheet is open, kept until Done.
  const [draft, setDraft] = useState<Date | null>(null);
  const openPicker = () => {
    setDraft(null);
    setOpen(true);
  };
  const minDate = kind === 'date' && min ? toPickerDate('date', min) : undefined;
  // A time is optional everywhere it is asked for, so a chosen time can be taken back.
  const clearable = kind === 'time' && value !== '';
  const pickerTestID = testID ? `${testID}-picker` : `${kind}-picker`;
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
      {Platform.OS === 'web' ? (
        <View style={[styles.field, { backgroundColor: t.color.bgAlt, borderColor: error ? t.color.danger : t.color.borderStrong }]} testID={testID}>
          <Icon size={18} color={t.color.textMuted} />
          <Text style={[styles.value, { color: shown ? t.color.text : t.color.textDim }]}>{shown || shownPlaceholder}</Text>
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
        <>
          <Pressable
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel={`${accessibilityLabel ?? label}, ${shown || shownPlaceholder}`}
            accessibilityHint={kind === 'date' ? 'Opens the date picker' : 'Opens the time picker'}
            testID={testID}
            style={[styles.field, { backgroundColor: t.color.bgAlt, borderColor: error ? t.color.danger : t.color.borderStrong }]}
          >
            <Icon size={18} color={t.color.textMuted} />
            <Text style={[styles.value, { color: shown ? t.color.text : t.color.textDim }]}>{shown || shownPlaceholder}</Text>
          </Pressable>
          {/* Android: mounting the picker opens the system dialog; it must be unmounted on any answer. */}
          {open && Platform.OS === 'android' ? (
            <DateTimePicker
              testID={pickerTestID}
              value={toPickerDate(kind, value)}
              mode={kind}
              is24Hour={false}
              minimumDate={minDate}
              neutralButton={clearable ? { label: 'Clear' } : undefined}
              onChange={(event: DateTimePickerEvent, picked?: Date) => {
                setOpen(false);
                if (event.type === 'set' && picked) onChange(fromPickerDate(kind, picked));
                else if (event.type === 'neutralButtonPressed') onChange('');
              }}
            />
          ) : null}
          {Platform.OS === 'ios' ? (
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
              <Pressable style={[styles.scrim, { backgroundColor: SCRIM }]} onPress={() => setOpen(false)} accessibilityLabel="Close without changing" accessibilityRole="button" />
              <View style={[styles.sheet, { backgroundColor: t.color.bgAlt, borderColor: t.color.border }]}>
                <DateTimePicker
                  testID={pickerTestID}
                  value={draft ?? toPickerDate(kind, value)}
                  mode={kind}
                  display="spinner"
                  minimumDate={minDate}
                  onChange={(_event: DateTimePickerEvent, picked?: Date) => {
                    if (picked) setDraft(picked);
                  }}
                />
                <View style={styles.sheetActions}>
                  {clearable ? (
                    <Pressable
                      onPress={() => {
                        setOpen(false);
                        onChange('');
                      }}
                      accessibilityRole="button"
                      style={styles.sheetButton}
                    >
                      <Text style={[styles.sheetButtonLabel, { color: t.color.textMuted }]}>Clear</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      setOpen(false);
                      onChange(fromPickerDate(kind, draft ?? toPickerDate(kind, value)));
                    }}
                    accessibilityRole="button"
                    style={styles.sheetButton}
                  >
                    <Text style={[styles.sheetButtonLabel, { color: t.accent.text }]}>Done</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          ) : null}
        </>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.helper, { color: t.color.dangerDeep }]}>
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
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { position: 'absolute', left: SPACE.s3, right: SPACE.s3, bottom: SPACE.s5, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACE.s2 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACE.s2 },
  sheetButton: { minHeight: MIN_TAP_TARGET, minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.s3 },
  sheetButtonLabel: { fontSize: FONT_SIZE.base, fontWeight: '700' },
});
