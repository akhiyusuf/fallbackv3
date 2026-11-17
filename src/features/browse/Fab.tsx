/** The round add button on tab screens. Hidden while a screen is empty (D15). */
import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export const FAB_SIZE = 56;
/** Bottom padding a scrolling list needs so its last row clears the add button. */
export const FAB_CLEARANCE = FAB_SIZE + SPACE.s5;

export function Fab({ onPress, accessibilityLabel = 'Add task' }: { onPress: () => void; accessibilityLabel?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.wrap, { backgroundColor: t.accent.fillEdge }]}>
      {({ pressed }) => (
        <View style={[styles.face, { backgroundColor: t.accent.fill, marginBottom: pressed ? 0 : 4 }]}>
          <Plus size={26} color={t.accent.onLarge} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: SPACE.s3, bottom: SPACE.s3, borderRadius: RADIUS.pill },
  face: { width: FAB_SIZE, height: FAB_SIZE, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
});
