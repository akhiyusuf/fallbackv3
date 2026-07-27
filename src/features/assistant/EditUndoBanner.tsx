/** M6. S32's inline "Edit-with-Undo" banner, embedded in an assistant turn. */
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';
import { Button } from '@/ui';
import { S32_COPY } from './copy';

export interface EditUndoBannerProps {
  readonly label: string;
  readonly onUndo: () => void;
  readonly undone?: boolean;
}

export function EditUndoBanner({ label, onUndo, undone = false }: EditUndoBannerProps) {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
      {undone ? null : (
        <>
          <Button label="Undo" onPress={onUndo} variant="secondary" accessibilityLabel={`Undo: ${label}`} />
          <Text style={[styles.caption, { color: t.color.textMuted }]}>{S32_COPY.undoCaption}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1, alignItems: 'flex-start' },
  label: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
});
