/**
 * M3. Shared floating add affordance for S09–S13. FAB-occlusion fix (cross-batch review
 * B5): every list screen pads its scroll content enough that this FAB never overlaps a
 * card's content at any scroll position — see each screen's `scrollContent` style.
 */
import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { SPACE } from '@/theme';
import { IconButton } from '@/ui';

export const FAB_CLEARANCE = SPACE.s8 + 56;

export function Fab({ onPress, accessibilityLabel = 'Add task' }: { onPress: () => void; accessibilityLabel?: string }) {
  return (
    <View style={styles.wrap}>
      <IconButton icon={Plus} variant="accent" accessibilityLabel={accessibilityLabel} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: SPACE.s3, bottom: SPACE.s4 },
});
