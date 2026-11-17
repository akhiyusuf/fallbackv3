/**
 * Screen — header + scrolling body + optional pinned action bar (D4, D8).
 * Every non-tab screen is built from this so spacing, scroll and the Save
 * position are identical everywhere.
 */
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPACE, useTheme } from '@/theme';
import { useToastStore } from '@/app-shell/stores/toast';
import { ScreenHeader, type ScreenHeaderProps } from './ScreenHeader';

export interface ScreenProps extends ScreenHeaderProps {
  readonly children: ReactNode;
  /** Pinned bottom action bar content (usually one Button, or a ButtonPair). */
  readonly footer?: ReactNode;
  readonly scroll?: boolean;
  readonly contentStyle?: StyleProp<ViewStyle>;
  /** Hide the header entirely (onboarding supplies its own top bar). */
  readonly headerless?: boolean;
  /** Rendered under the header, above the scroll area (search field, filters). */
  readonly subheader?: ReactNode;
  /** Absolutely positioned overlay inside the screen (the add button). */
  readonly overlay?: ReactNode;
}

// The keyboard: Android draws the app edge to edge, so the window is NOT resized when the keyboard
// opens (the old Android behaviour). Padding the screen by the keyboard's height on both platforms
// keeps the focused field and the pinned button above it.
export function Screen({ children, footer, scroll = true, contentStyle, headerless = false, subheader, overlay, ...header }: ScreenProps) {
  const t = useTheme();
  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: t.color.bg }]} behavior="padding">
      {headerless ? null : <ScreenHeader {...header} />}
      {subheader}
      {scroll ? (
        <ScrollView alwaysBounceVertical={false} overScrollMode="auto" style={styles.flex} contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
      )}
      {overlay}
      {footer ? <ActionBar>{footer}</ActionBar> : null}
    </KeyboardAvoidingView>
  );
}

/** The pinned bottom bar. Also lifts the toast so it never covers the button. */
export function ActionBar({ children }: { readonly children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const register = useToastStore((s) => s.registerActionBar);
  useEffect(() => register(), [register]);
  return (
    <View style={[styles.actionBar, { backgroundColor: t.color.bgAlt, borderTopColor: t.color.border, paddingBottom: SPACE.s3 + insets.bottom }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s2, paddingBottom: SPACE.s5, gap: SPACE.s3 },
  actionBar: { borderTopWidth: 1, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s3, gap: SPACE.s2 },
});
