/**
 * ScreenHeader — the ONE header every screen uses (DESIGN_DECISIONS D4).
 *  - level "tab":  24 bold title, left aligned, optional subtitle line, right icons.
 *  - level "page": back chevron + 20 bold title, left aligned, optional right action.
 * Same fixed height on both so content never jumps between screens.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT_SIZE, HEADER_HEIGHT, SPACE, useTheme } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from '@/ui/AppText';

export interface ScreenHeaderProps {
  readonly title?: string;
  readonly level?: 'tab' | 'page';
  readonly subtitle?: string;
  readonly onBack?: () => void;
  /** "close" renders a cross instead of a chevron — reserved for the add menu and icon picker (D5). */
  readonly backIcon?: 'back' | 'close';
  readonly backLabel?: string;
  /** Rendered between the back button and the title (e.g. a task icon circle). */
  readonly leading?: ReactNode;
  readonly right?: ReactNode;
  readonly testID?: string;
}

export function ScreenHeader({ title, level = 'page', subtitle, onBack, backIcon = 'back', backLabel, leading, right, testID }: ScreenHeaderProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const isTab = level === 'tab';
  return (
    <View style={[styles.root, isTab && subtitle ? styles.rootRoomy : null, { paddingTop: insets.top, backgroundColor: t.color.bg }]} testID={testID}>
      <View style={[styles.bar, isTab ? styles.barTab : styles.barPage]}>
        {!isTab && onBack ? (
          <IconButton icon={backIcon === 'close' ? X : ChevronLeft} onPress={onBack} accessibilityLabel={backLabel ?? (backIcon === 'close' ? 'Close' : 'Back')} />
        ) : null}
        {leading}
        <View style={styles.titleCol}>
          {title ? (
            <Text accessibilityRole="header" numberOfLines={1} style={[isTab ? styles.titleTab : styles.titlePage, { color: t.color.text }]}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text numberOfLines={1} style={[styles.subtitle, { color: t.color.textMuted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {},
  // A tab header with a date line under the title needs air before the first card.
  rootRoomy: { paddingBottom: SPACE.s2 },
  bar: { minHeight: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  barTab: { paddingLeft: SPACE.s3, paddingRight: SPACE.s2, paddingVertical: SPACE.s1 },
  barPage: { paddingLeft: SPACE.s1, paddingRight: SPACE.s2 },
  titleCol: { flex: 1, justifyContent: 'center' },
  titleTab: { fontSize: FONT_SIZE.xl, fontWeight: '700', lineHeight: 30 },
  titlePage: { fontSize: FONT_SIZE.lg, fontWeight: '700', lineHeight: 26 },
  subtitle: { fontSize: FONT_SIZE.sm, lineHeight: 18 },
  right: { flexDirection: 'row', alignItems: 'center' },
});
