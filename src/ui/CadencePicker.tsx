/**
 * M0 kit — Fallback-custom `CadencePicker`. The shared "Repeats" control (S16/S17/S18,
 * Decision 13): a kind `Select` plus the matching sub-control — `WeekdayPicker` for
 * Specific weekdays, a single-anchor `Select` for Weekly…Yearly. Purely presentational over
 * the `Cadence` union; callers own save-time validation (`@/domain`'s `validateTaskDraft`).
 */
import { StyleSheet, View } from 'react-native';

import { SPACE } from '@/theme';
import { today as todayFn } from '@/lib/date';
import type { Cadence, CadenceKind, LocalDate, Weekday } from '@/types';

import { Select, type SelectOption } from './Select';
import { WeekdayPicker } from './WeekdayPicker';

export interface CadencePickerProps {
  readonly value: Cadence;
  readonly onChange: (cadence: Cadence) => void;
  readonly weekdayError?: string;
  readonly testID?: string;
}

const KIND_OPTIONS: readonly SelectOption[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'specific-weekdays', label: 'Specific weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-monthly', label: 'Bi-monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const WEEKDAY_OPTIONS: readonly SelectOption[] = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '7', label: 'Sunday' },
];

const DAY_OF_MONTH_OPTIONS: readonly SelectOption[] = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

const MONTH_OPTIONS: readonly SelectOption[] = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
].map((label, i) => ({ value: String(i + 1), label }));

function nextCadenceForKind(kind: CadenceKind, previous: Cadence, today: LocalDate): Cadence {
  switch (kind) {
    case 'daily':
      return { kind: 'daily' };
    case 'specific-weekdays':
      return { kind: 'specific-weekdays', weekdays: 'weekdays' in previous ? previous.weekdays : [] };
    case 'weekly':
      return { kind: 'weekly', weekday: 'weekday' in previous ? previous.weekday : 1, anchorDate: 'anchorDate' in previous ? previous.anchorDate : today };
    case 'bi-weekly':
      return { kind: 'bi-weekly', weekday: 'weekday' in previous ? previous.weekday : 1, anchorDate: 'anchorDate' in previous ? previous.anchorDate : today };
    case 'monthly':
      return { kind: 'monthly', dayOfMonth: 'dayOfMonth' in previous ? previous.dayOfMonth : 1, anchorDate: 'anchorDate' in previous ? previous.anchorDate : today };
    case 'bi-monthly':
      return { kind: 'bi-monthly', dayOfMonth: 'dayOfMonth' in previous ? previous.dayOfMonth : 1, anchorDate: 'anchorDate' in previous ? previous.anchorDate : today };
    case 'yearly':
      return {
        kind: 'yearly',
        month: 'month' in previous ? previous.month : 1,
        dayOfMonth: 'dayOfMonth' in previous ? previous.dayOfMonth : 1,
        anchorDate: 'anchorDate' in previous ? previous.anchorDate : today,
      };
  }
}

export function CadencePicker({ value, onChange, weekdayError, testID }: CadencePickerProps) {
  const today = todayFn();

  return (
    <View style={styles.root} testID={testID}>
      <Select
        label="Repeats"
        value={value.kind}
        options={KIND_OPTIONS}
        onChange={(kind) => onChange(nextCadenceForKind(kind as CadenceKind, value, today))}
        accessibilityLabel="Repeats"
      />

      {value.kind === 'specific-weekdays' ? (
        <WeekdayPicker
          selected={value.weekdays}
          onChange={(weekdays) => onChange({ kind: 'specific-weekdays', weekdays })}
          accessibilityLabel="Which days this repeats"
          error={weekdayError}
        />
      ) : null}

      {(value.kind === 'weekly' || value.kind === 'bi-weekly') ? (
        <Select
          label={value.kind === 'weekly' ? 'Every week on' : 'Every 2 weeks on'}
          value={String(value.weekday)}
          options={WEEKDAY_OPTIONS}
          onChange={(w) => onChange({ ...value, weekday: Number(w) as Weekday })}
          accessibilityLabel="Weekday"
        />
      ) : null}

      {(value.kind === 'monthly' || value.kind === 'bi-monthly') ? (
        <Select
          label={value.kind === 'monthly' ? 'Every month on the' : 'Every 2 months on the'}
          value={String(value.dayOfMonth)}
          options={DAY_OF_MONTH_OPTIONS}
          onChange={(d) => onChange({ ...value, dayOfMonth: Number(d) })}
          accessibilityLabel="Day of month"
        />
      ) : null}

      {value.kind === 'yearly' ? (
        <View style={styles.yearlyRow}>
          <Select
            label="Every year in"
            value={String(value.month)}
            options={MONTH_OPTIONS}
            onChange={(m) => onChange({ ...value, month: Number(m) })}
            accessibilityLabel="Month"
          />
          <Select
            label="On the"
            value={String(value.dayOfMonth)}
            options={DAY_OF_MONTH_OPTIONS}
            onChange={(d) => onChange({ ...value, dayOfMonth: Number(d) })}
            accessibilityLabel="Day of month"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s2 },
  yearlyRow: { flexDirection: 'row', gap: SPACE.s2 },
});
