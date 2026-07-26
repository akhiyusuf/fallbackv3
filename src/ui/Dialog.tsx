/** M0 kit — Verdant `Dialog`. In-app sheet/modal shell — scrim + soft-shadow surface, optional drag handle. */
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { RADIUS, SCRIM, SPACE, useTheme } from '@/theme';
import { IconButton } from './IconButton';

export interface DialogProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly children: ReactNode;
  readonly presentation?: 'sheet' | 'center';
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

export function Dialog({ visible, onClose, title, children, presentation = 'sheet', accessibilityLabel, testID }: DialogProps) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType={presentation === 'sheet' ? 'slide' : 'fade'} onRequestClose={onClose} testID={testID}>
      <View
        style={[styles.scrim, { backgroundColor: SCRIM, justifyContent: presentation === 'sheet' ? 'flex-end' : 'center' }]}
        accessibilityViewIsModal
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" accessibilityRole="button" />
        <View
          style={[
            presentation === 'sheet' ? styles.sheet : styles.center,
            { backgroundColor: t.color.bg },
          ]}
          accessibilityRole="none"
          accessibilityLabel={accessibilityLabel}
        >
          {presentation === 'sheet' ? <View style={[styles.handle, { backgroundColor: t.color.border }]} /> : null}
          {title ? (
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
                {title}
              </Text>
              <IconButton icon={X} onPress={onClose} accessibilityLabel="Close" />
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACE.s3, maxHeight: '90%', gap: SPACE.s2 },
  center: { margin: SPACE.s4, borderRadius: RADIUS.lg, padding: SPACE.s3, gap: SPACE.s2 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: SPACE.s2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
});
