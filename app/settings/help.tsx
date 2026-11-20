/** S49 — Help and about. Same grouped rows as the rest of Settings (D7). */
import { useRouter, type Href } from 'expo-router';
import { FileText, LifeBuoy, Mail, ShieldCheck, Star, type LucideIcon } from 'lucide-react-native';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { useToastStore } from '@/app-shell';
import { S49_COPY } from '@/features/settings/copy';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { ListGroup, ListRow, Screen } from '@/ui';
import { Text } from '@/ui/AppText';

const ANDROID_PACKAGE = 'com.fallback.app';
const PLAY_STORE_URL = `market://details?id=${ANDROID_PACKAGE}`;

const ICONS: Record<string, LucideIcon> = {
  'Contact support': Mail,
  'FAQ and guides': LifeBuoy,
  'Rate Fallback': Star,
  'Privacy policy': ShieldCheck,
  'Terms of service': FileText,
};

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
        if (await Linking.canOpenURL(PLAY_STORE_URL)) {
          await Linking.openURL(PLAY_STORE_URL);
          return;
        }
      } catch {
        /* fall through to the toast */
      }
    }
    showToast(row.toast, 'neutral');
  }

  return (
    <Screen title="Help and about" onBack={handleBack}>
      <ListGroup title="Support">
        {S49_COPY.supportSection.map((row) => (
          <ListRow
            key={row.label}
            icon={ICONS[row.label]}
            label={row.label}
            onPress={() => void handleSupportRow(row)}
            accessibilityLabel={`${row.label}, ${row.a11yDestination}`}
          />
        ))}
      </ListGroup>

      <ListGroup title="Legal" footer={S49_COPY.privacy}>
        {S49_COPY.legalSection.map((row) => (
          <ListRow key={row.label} icon={ICONS[row.label]} label={row.label} onPress={() => showToast(row.toast, 'neutral')} accessibilityLabel={`${row.label}, opens an external page`} />
        ))}
      </ListGroup>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: t.color.textDim }]}>{S49_COPY.version}</Text>
        <Text style={[styles.version, { color: t.color.textDim }]}>{S49_COPY.tagline}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', gap: SPACE.s1, paddingVertical: SPACE.s3 },
  version: { fontSize: FONT_SIZE.xs },
});
