/**
 * EmptyArt — the small drawing on an empty screen. One shape language for all of them: a soft
 * blob of the theme tint, a white tile with the subject on it, a gold spark. Drawn with the
 * theme's own colors, so it follows every theme and both appearances.
 */
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';
import type { IconComponent } from './icon';

export type EmptyArtKind = 'calendar' | 'tile';

export function EmptyArt({ kind = 'tile', icon: Icon }: { readonly kind?: EmptyArtKind; readonly icon?: IconComponent }) {
  const t = useTheme();
  const spark = <Path d="M124 18l2.4 6.4L133 27l-6.6 2.6L124 36l-2.4-6.4L115 27l6.6-2.6z" fill={t.color.celebrationGold} />;
  return (
    <View style={{ width: 156, height: 104, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={156} height={104} viewBox="0 0 156 104" style={{ position: 'absolute' }}>
        <Ellipse cx={78} cy={60} rx={70} ry={38} fill={t.accent.soft} />
        {kind === 'calendar' ? (
          <>
            <Rect x={44} y={20} width={68} height={62} rx={11} fill={t.color.bgAlt} stroke={t.color.borderStrong} strokeWidth={2} />
            <Path d="M44 31a11 11 0 0 1 11-11h46a11 11 0 0 1 11 11v8H44z" fill={t.accent.fill} />
            <Rect x={58} y={13} width={5} height={13} rx={2.5} fill={t.color.borderStrong} />
            <Rect x={93} y={13} width={5} height={13} rx={2.5} fill={t.color.borderStrong} />
            <Circle cx={62} cy={53} r={5.5} fill={t.color.ideal} />
            <Circle cx={78} cy={53} r={5.5} fill={t.color.fallback} />
            <Circle cx={94} cy={53} r={5.5} fill={t.color.borderStrong} />
            <Circle cx={62} cy={69} r={5.5} fill={t.color.borderStrong} />
            <Circle cx={78} cy={69} r={4.5} fill="none" stroke={t.accent.text} strokeWidth={2.5} />
          </>
        ) : (
          <Rect x={46} y={20} width={64} height={64} rx={18} fill={t.color.bgAlt} stroke={t.color.borderStrong} strokeWidth={2} />
        )}
        {spark}
        <Circle cx={26} cy={36} r={4} fill={t.color.celebrationGold} />
      </Svg>
      {/* In its own layer so it paints above the drawing on the web as well. */}
      {kind === 'tile' && Icon ? (
        <View style={{ zIndex: 1 }}>
          <Icon size={30} color={t.accent.text} />
        </View>
      ) : null}
    </View>
  );
}
