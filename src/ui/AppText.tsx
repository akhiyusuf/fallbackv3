/**
 * `Text` and `TextInput` in the app's typeface. Every screen imports these two from here instead
 * of from `react-native`, because React Native has no app-wide default font: a text with no
 * `fontFamily` falls back to the phone's own face. The family is registered natively with one
 * file per weight (see the `expo-font` entry in app.config.ts), so `fontWeight` picks the file.
 */
import type { Ref } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

import { FONT_FAMILY } from '@/theme/tokens';

const styles = StyleSheet.create({ face: { fontFamily: FONT_FAMILY } });

export function Text({ style, ...rest }: TextProps & { ref?: Ref<RNText> }) {
  return <RNText {...rest} style={[styles.face, style]} />;
}
// So `useRef<Text>(null)` keeps meaning the native text element.
export type Text = RNText;

export function TextInput({ style, ...rest }: TextInputProps & { ref?: Ref<RNTextInput> }) {
  return <RNTextInput {...rest} style={[styles.face, style]} />;
}
export type TextInput = RNTextInput;
