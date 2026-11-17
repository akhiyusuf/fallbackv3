/** An edit the assistant made, with a quiet Undo beside it. */
import { Pressable, StyleSheet, View } from 'react-native';
import { Pencil } from 'lucide-react-native';

import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { S32_COPY } from './copy';
import { Text } from '@/ui/AppText';

export interface EditUndoBannerProps {
  readonly label: string;
  readonly onUndo: () => void;
  readonly undone?: boolean;
}

export function EditUndoBanner({ label, onUndo, undone = false }: EditUndoBannerProps) {
  const t = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: t.color.surface }]}>
      <Pencil size={16} color={t.color.textMuted} />
      <View style={styles.text}>
        <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
        {undone ? null : <Text style={[styles.caption, { color: t.color.textMuted }]}>{S32_COPY.undoCaption}</Text>}
      </View>
      {undone ? null : (
        <Pressable onPress={onUndo} accessibilityRole="button" accessibilityLabel={`Undo: ${label}`} hitSlop={8} style={styles.undo}>
          <Text style={[styles.undoLabel, { color: t.color.text }]}>Undo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4, borderRadius: RADIUS.md, paddingVertical: SPACE.s2 + 2, paddingHorizontal: SPACE.s3 },
  text: { flex: 1, gap: 2 },
  label: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  caption: { fontSize: FONT_SIZE.xs, lineHeight: 18 },
  undo: { minHeight: 44, justifyContent: 'center' },
  undoLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', textDecorationLine: 'underline' },
});
