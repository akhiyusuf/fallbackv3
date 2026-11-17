/**
 * Dialog — the bottom sheet (D3). Slides over the dimmed current screen:
 * handle, title, content. Used by confirmations, dropdown lists and menus.
 * `presentation="center"` is reserved for the milestone pop-up (D2).
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT_SIZE, RADIUS, SCRIM, SPACE, useTheme } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from '@/ui/AppText';

export interface DialogProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly children: ReactNode;
  readonly presentation?: 'sheet' | 'center';
  /** Show a cross in the title row. Off by default — a sheet is dismissed by its buttons or the scrim. */
  readonly showClose?: boolean;
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

export function Dialog({ visible, onClose, title, children, presentation = 'sheet', showClose = false, accessibilityLabel, testID }: DialogProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const isSheet = presentation === 'sheet';
  return (
    <Modal visible={visible} transparent animationType={isSheet && Platform.OS !== 'web' ? 'slide' : 'fade'} onRequestClose={onClose} testID={testID}>
      {/* Padded by the keyboard, so a dialog with a field (rename, edit) is not hidden under it. */}
      <KeyboardAvoidingView behavior="padding" style={[styles.scrim, { backgroundColor: SCRIM, justifyContent: isSheet ? 'flex-end' : 'center' }]} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" accessibilityRole="button" />
        <View
          style={[isSheet ? styles.sheet : styles.center, { backgroundColor: t.color.bg }, isSheet && { paddingBottom: SPACE.s4 + insets.bottom }]}
          accessibilityRole="none"
          accessibilityLabel={accessibilityLabel}
        >
          {isSheet ? <View style={[styles.handle, { backgroundColor: t.color.borderStrong }]} /> : null}
          {title ? (
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
                {title}
              </Text>
              {showClose ? <IconButton icon={X} onPress={onClose} accessibilityLabel="Close" /> : null}
            </View>
          ) : null}
          {isSheet ? (
            <ScrollView alwaysBounceVertical={false} overScrollMode="auto" style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s2, maxHeight: '88%', gap: SPACE.s2 },
  center: { marginHorizontal: SPACE.s4, borderRadius: RADIUS.lg, padding: SPACE.s4, gap: SPACE.s2, alignSelf: 'center', width: '86%', maxWidth: 380 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACE.s2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', flexShrink: 1 },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: SPACE.s3, paddingBottom: SPACE.s1 },
});
