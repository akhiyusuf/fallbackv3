/**
 * M0. Scaffold placeholder so every route renders before its module is built.
 * Feature builders DELETE the <ScreenStub/> usage from their own route files as they
 * implement each screen. This component itself stays in M0 and is never edited.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';

export interface ScreenStubProps {
  /** e.g. "S09" */
  screen: string;
  /** e.g. "Today" */
  title: string;
  /** e.g. "/today" */
  route: string;
  /** e.g. "M3" */
  module: string;
  /** e.g. "F3, F4, F5, F6, F14" */
  features: string;
}

export function ScreenStub({ screen, title, route, module, features }: ScreenStubProps) {
  const t = useTheme();
  return (
    <ScrollView
      style={[styles.root, { backgroundColor: t.color.bg }]}
      contentContainerStyle={styles.content}
      accessibilityLabel={`${screen} ${title} placeholder`}
    >
      <Text style={[styles.eyebrow, { color: t.accent.base }]}>{screen}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: t.color.bgAlt, borderColor: t.color.border }]}>
        <Row label="route" value={route} />
        <Row label="module" value={module} />
        <Row label="features" value={features} />
      </View>
      <Text style={[styles.note, { color: t.color.textMuted }]}>
        Scaffold placeholder. Implemented by {module} per docs/MODULES.md.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: t.color.textDim }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: t.color.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s4, gap: SPACE.s3 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  title: { fontSize: 32, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 12, padding: SPACE.s3, gap: SPACE.s2 },
  row: { flexDirection: 'row', gap: SPACE.s2 },
  rowLabel: { fontSize: 12, width: 72 },
  rowValue: { fontSize: 14, flexShrink: 1 },
  note: { fontSize: 14, lineHeight: 22 },
});
