/**
 * ConfirmSheet — every confirmation in the app (D3): bottom sheet over the
 * dimmed screen with a title, one sentence and the stacked button pair (D11).
 */
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { FONT_SIZE, useTheme } from '@/theme';
import { ButtonPair } from './ButtonPair';
import { Dialog } from './Dialog';
import { Text } from '@/ui/AppText';

export interface ConfirmSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
  readonly loading?: boolean;
  /** Optional extra content between the sentence and the buttons (e.g. an error banner). */
  readonly children?: ReactNode;
  readonly testID?: string;
}

export function ConfirmSheet({ visible, onClose, title, message, confirmLabel, onConfirm, cancelLabel = 'Cancel', danger = false, loading = false, children, testID }: ConfirmSheetProps) {
  const t = useTheme();
  return (
    <Dialog visible={visible} onClose={loading ? () => undefined : onClose} title={title} accessibilityLabel={title} testID={testID}>
      <Text style={[styles.message, { color: t.color.textMuted }]}>{message}</Text>
      {children}
      <ButtonPair
        primary={{ label: confirmLabel, onPress: onConfirm, danger, loading, disabled: loading }}
        secondary={{ label: cancelLabel, onPress: onClose, disabled: loading }}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({ message: { fontSize: FONT_SIZE.base, lineHeight: 24 } });
