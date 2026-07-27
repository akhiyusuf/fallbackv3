/**
 * S49 — Help & About    route: /settings/help
 * Owner: M7. Features: F9.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S49)
 */
import { useRouter, type Href } from 'expo-router';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useToastStore } from '@/app-shell';
import { S49_COPY } from '@/features/settings/copy';
import { SettingsHeader } from '@/features/settings/SettingsHeader';
import { SPACE, useTheme } from '@/theme';
import { Card } from '@/ui';

/**
 * Review pass 1, blocking item 7: the concrete support email / FAQ URL / legal URLs are
 * pinned NOWHERE upstream (not IDEA.md, not ALLSCREENS_1.md, not PRD) — a genuine product
 * gap, flagged in the module's final report rather than invented here. Android's Play Store
 * CAN be reached generically by package name alone (no numeric app id needed, unlike iOS's
 * App Store, which requires one and has none pinned) — `app.config.ts`'s already-declared
 * `android.package` is a real, existing target, so that ONE hand-off is implemented for real
 * on Android. Every other row (and Rate Fallback on iOS) keeps the toast — an explicitly
 * disclosed interim behaviour, not a silent gap.
 */
const ANDROID_PACKAGE = 'com.fallback.app';
const PLAY_STORE_URL = `market://details?id=${ANDROID_PACKAGE}`;

export default function S49HelpAndAbout() {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);

  function handleBack() {
    router.push('/settings' as Href);
  }

  async function handleSupportRow(row: (typeof S49_COPY.supportSection)[number]) {
    if (row.label === 'Rate Fallback' && Platform.OS === 'android') {
      try {
        const canOpen = await Linking.canOpenURL(PLAY_STORE_URL);
        if (canOpen) {
          await Linking.openURL(PLAY_STORE_URL);
          return;
        }
      } catch {
        // Falls through to the calm toast below — never a hard error over a rating hand-off.
      }
    }
    showToast(row.toast, 'neutral');
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <SettingsHeader title={S49_COPY.title} onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card accessibilityLabel="Support">
          {S49_COPY.supportSection.map((row) => (
            <Card
              key={row.label}
              onPress={() => void handleSupportRow(row)}
              accessibilityLabel={`${row.label}, ${row.a11yDestination}`}
              style={styles.row}
            >
              <Text style={[styles.rowLabel, { color: t.color.text }]}>{row.label}</Text>
            </Card>
          ))}
        </Card>

        <Card accessibilityLabel="Legal">
          {S49_COPY.legalSection.map((row) => (
            <Card key={row.label} onPress={() => showToast(row.toast, 'neutral')} accessibilityLabel={`${row.label}, opens an external page`} style={styles.row}>
              <Text style={[styles.rowLabel, { color: t.color.text }]}>{row.label}</Text>
            </Card>
          ))}
        </Card>

        <Card accessibilityLabel={S49_COPY.privacy}>
          <Text style={[styles.privacy, { color: t.color.textMuted }]}>{S49_COPY.privacy}</Text>
        </Card>

        <View style={styles.footer}>
          <Text style={[styles.version, { color: t.color.textDim }]}>{S49_COPY.version}</Text>
          <Text style={[styles.tagline, { color: t.color.textDim }]}>{S49_COPY.tagline}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  row: { paddingVertical: SPACE.s1 },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  privacy: { fontSize: 14, lineHeight: 20 },
  footer: { alignItems: 'center', gap: 4, paddingVertical: SPACE.s3 },
  version: { fontSize: 13 },
  tagline: { fontSize: 13 },
});
