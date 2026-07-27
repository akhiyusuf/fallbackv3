/** M5 — shared back-chevron + title app bar for S25-S30. */
import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';
import { IconButton } from '@/ui';

export interface ProgressHeaderProps {
  readonly title: string;
  readonly onBack: () => void;
}

export function ProgressHeader({ title, onBack }: ProgressHeaderProps) {
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
