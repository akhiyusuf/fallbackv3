/** MenuSheet — an action menu as a bottom sheet (D3): one grouped list of actions. */
import { StyleSheet } from 'react-native';

import { FONT_SIZE, useTheme } from '@/theme';
import { Dialog } from './Dialog';
import { ListGroup, ListRow } from './ListGroup';
import type { IconComponent } from './icon';
import { Text } from '@/ui/AppText';

export interface MenuSheetItem {
  readonly key: string;
  readonly icon?: IconComponent;
  readonly label: string;
  readonly sublabel?: string;
  readonly onPress: () => void;
  readonly danger?: boolean;
  /** True when the item opens another screen (shows a chevron). */
  readonly opensScreen?: boolean;
}

export interface MenuSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly caption?: string;
  readonly items: readonly MenuSheetItem[];
  readonly testID?: string;
}

export function MenuSheet({ visible, onClose, title, caption, items, testID }: MenuSheetProps) {
  const t = useTheme();
  return (
    <Dialog visible={visible} onClose={onClose} title={title} accessibilityLabel={title} testID={testID}>
      {caption ? <Text style={[styles.caption, { color: t.color.textMuted }]}>{caption}</Text> : null}
      <ListGroup>
        {items.map((item) => (
          <ListRow
            key={item.key}
            icon={item.icon}
            label={item.label}
            sublabel={item.sublabel}
            danger={item.danger}
            chevron={!!item.opensScreen}
            onPress={() => {
              onClose();
              item.onPress();
            }}
          />
        ))}
      </ListGroup>
    </Dialog>
  );
}

const styles = StyleSheet.create({ caption: { fontSize: FONT_SIZE.sm, lineHeight: 20 } });
