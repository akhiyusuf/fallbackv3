/**
 * WeekStrip — the last seven days of one task, drawn. Green tick = ideal, blue tick =
 * fallback, grey dash = an off day, empty ring = missed, theme ring = today and still open,
 * dashed ring = not due. Colour is never the only signal: each state has its own mark.
 */
import { StyleSheet, View } from 'react-native';
import { Check, CheckCheck, Minus } from 'lucide-react-native';

import { FONT_SIZE, useTheme } from '@/theme';
import { Text } from '@/ui/AppText';

export type WeekDayState = 'ideal' | 'fallback' | 'off' | 'missed' | 'open' | 'none';

export interface WeekStripDay {
  readonly key: string;
  /** One letter, e.g. "M". */
  readonly label: string;
  readonly state: WeekDayState;
  readonly isToday?: boolean;
}

const SPOKEN: Record<WeekDayState, string> = { ideal: 'ideal', fallback: 'fallback', off: 'off day', missed: 'missed', open: 'not logged yet', none: 'not due' };

export function WeekStrip({ days, size = 28 }: { readonly days: readonly WeekStripDay[]; readonly size?: number }) {
  const t = useTheme();
  const summary = days.map((d) => `${d.label} ${SPOKEN[d.state]}`).join(', ');
  return (
    <View style={styles.root} accessible accessibilityRole="text" accessibilityLabel={`Last seven days: ${summary}`}>
      {days.map((d) => {
        const dot = { width: size, height: size, borderRadius: size / 2 };
        return (
          <View key={d.key} style={styles.day}>
            {d.state === 'ideal' ? (
              <View style={[styles.dot, dot, { backgroundColor: t.color.ideal }]}>
                <CheckCheck size={size * 0.55} color={t.color.iconOnSignal} />
              </View>
            ) : d.state === 'fallback' ? (
              <View style={[styles.dot, dot, { backgroundColor: t.color.fallback }]}>
                <Check size={size * 0.55} color={t.color.iconOnSignal} />
              </View>
            ) : d.state === 'off' ? (
              <View style={[styles.dot, dot, { backgroundColor: t.color.surface }]}>
                <Minus size={size * 0.55} color={t.color.textMuted} />
              </View>
            ) : (
              <View
                style={[
                  styles.dot,
                  dot,
                  d.state === 'open'
                    ? { borderWidth: 3, borderColor: t.accent.text }
                    : d.state === 'missed'
                      ? { borderWidth: 2, borderColor: t.color.borderStrong }
                      : { borderWidth: 2, borderColor: t.color.border, borderStyle: 'dashed' },
                ]}
              />
            )}
            <Text style={[styles.label, { color: d.isToday ? t.accent.text : t.color.textMuted, fontWeight: d.isToday ? '800' : '600' }]}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 3, flex: 1 },
  dot: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: FONT_SIZE.xs },
});
