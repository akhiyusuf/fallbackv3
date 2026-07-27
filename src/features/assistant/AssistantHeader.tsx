/** M6. Shared back-chevron (+ optional title/trailing) header for the assistant screens. */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { IconButton } from '@/ui';

export interface AssistantHeaderProps {
  readonly title?: string;
  readonly onBack: () => void;
  readonly trailing?: ReactNode;
}

export function AssistantHeader({ title, onBack, trailing }: AssistantHeaderProps) {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <IconButton icon={ChevronLeft} onPress={onBack} accessibilityLabel="Back" />
      {title ? (
        <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}
      {trailing ?? <View style={styles.trailingSlot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, paddingHorizontal: SPACE.s2, paddingVertical: SPACE.s2 },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  spacer: { flex: 1 },
  trailingSlot: { width: 40 },
});
