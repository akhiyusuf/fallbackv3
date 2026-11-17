import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { createRef } from 'react';

import { FONT_FAMILY } from '@/theme/tokens';

import { Text, TextInput } from './AppText';

describe('AppText', () => {
  it('Text sets the app typeface and renders its children', async () => {
    await render(<Text>Hello there</Text>);
    const node = screen.getByText('Hello there');
    expect(StyleSheet.flatten(node.props.style)).toMatchObject({ fontFamily: FONT_FAMILY });
  });

  it('Text keeps the caller’s style alongside the typeface', async () => {
    await render(<Text style={{ color: '#123456', fontWeight: '700', fontSize: 18 }}>Styled</Text>);
    const style = StyleSheet.flatten(screen.getByText('Styled').props.style);
    expect(style).toMatchObject({ fontFamily: FONT_FAMILY, color: '#123456', fontWeight: '700', fontSize: 18 });
  });

  it('Text passes its ref through to the native text element', async () => {
    const ref = createRef<Text>();
    await render(<Text ref={ref}>With ref</Text>);
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current).toBe('object');
  });

  it('TextInput sets the app typeface, keeps the caller’s style and forwards its props', async () => {
    await render(<TextInput placeholder="Name" style={{ fontSize: 16 }} accessibilityLabel="Name field" />);
    const input = screen.getByLabelText('Name field');
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({ fontFamily: FONT_FAMILY, fontSize: 16 });
    expect(input.props.placeholder).toBe('Name');
  });

  it('TextInput passes its ref through to the native input', async () => {
    const ref = createRef<TextInput>();
    await render(<TextInput ref={ref} accessibilityLabel="Ref field" />);
    expect(ref.current).not.toBeNull();
  });
});
