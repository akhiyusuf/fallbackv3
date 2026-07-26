/** M1. Shared back-chevron + title header for S45/S47 — both "back always returns to S41". */
import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';
import { IconButton } from '@/ui';

export interface SettingsHeaderProps {
  readonly title: string;
  readonly onBack: () => void;
}

export function SettingsHeader({ title, onBack }: SettingsHeaderProps) {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <IconButton icon={ChevronLeft} onPress={onBack} accessibilityLabel="Back" />
      <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, paddingHorizontal: SPACE.s2, paddingVertical: SPACE.s2 },
  title: { fontSize: 20, fontWeight: '700' },
});
