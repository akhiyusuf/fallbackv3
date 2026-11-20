/**
 * OnboardingPicture — the drawing at the top of each onboarding step. Every step has its own.
 * It pictures the idea in the headline; it must never be a small copy of the content below it
 * (that says the same thing twice). Drawn from the theme's own colors on a
 * 220 x 148 canvas and scaled to whatever room the step leaves, so it never forces a scroll.
 */
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Bell, Check, CheckCheck, Minus, Paintbrush, Plus } from 'lucide-react-native';

import { useTheme, type Theme } from '@/theme';
import { useReduceMotion } from '@/ui';
import { Text } from '@/ui/AppText';

export const PICTURE_WIDTH = 220;
export const PICTURE_HEIGHT = 148;

export function OnboardingPicture({ step, scale }: { readonly step: 1 | 2 | 3 | 4 | 5 | 6 | 7; readonly scale: number }) {
  const t = useTheme();
  const reduced = useReduceMotion();
  const enter = useState(() => new Animated.Value(reduced ? 1 : 0))[0];
  useEffect(() => {
    if (reduced) return;
    Animated.spring(enter, { toValue: 1, damping: 11, stiffness: 170, mass: 0.8, useNativeDriver: true }).start();
  }, [enter, reduced]);
  const Drawing = DRAWINGS[step];
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: PICTURE_WIDTH,
        height: PICTURE_HEIGHT,
        opacity: enter,
        transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [scale * 0.8, scale] }) }],
      }}
    >
      <Drawing t={t} />
    </Animated.View>
  );
}

type Draw = (props: { readonly t: Theme }) => React.JSX.Element;

function Spark({ t, left, top, size = 12 }: { readonly t: Theme; readonly left: number; readonly top: number; readonly size?: number }) {
  return <View style={{ position: 'absolute', left, top, width: size, height: size, borderRadius: 3, backgroundColor: t.color.celebrationGold, transform: [{ rotate: '45deg' }] }} />;
}

function Dot({ color, size, children, style }: { readonly color: string; readonly size: number; readonly children?: React.ReactNode; readonly style?: object }) {
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }, style]}>{children}</View>;
}

/** 2 — Something beats nothing: one plant, a green leaf and a blue leaf. Both make it grow. */
const Sprout: Draw = ({ t }) => (
  <View style={s.canvas}>
    <View style={[s.tile, { width: 108, height: 108, borderRadius: 30, backgroundColor: t.color.bgAlt, transform: [{ rotate: '-4deg' }] }]}>
      <Svg width={84} height={84} viewBox="0 0 84 84">
        <Rect x={20} y={66} width={44} height={8} rx={4} fill={t.color.borderStrong} />
        <Path d="M42 68V34" stroke={t.color.text} strokeWidth={5} strokeLinecap="round" />
        <Path d="M42 48C24 48 14 36 14 20 32 20 42 32 42 48Z" fill={t.color.ideal} />
        <Path d="M42 38C58 38 68 28 68 12 52 12 42 22 42 38Z" fill={t.color.fallback} />
      </Svg>
    </View>
    <Spark t={t} left={178} top={22} />
    <Spark t={t} left={26} top={98} size={8} />
  </View>
);

/** 1 — A plan A and a plan B: two cards, one green, one blue. */
const PlanAB: Draw = ({ t }) => (
  <View style={[s.canvas, s.row]}>
    {(
      [
        ['A', t.color.ideal, CheckCheck, '-7deg', 6],
        ['B', t.color.fallback, Check, '6deg', -6],
      ] as const
    ).map(([letter, color, Icon, rotate, pull]) => (
      <View key={letter} style={[s.tile, { width: 84, height: 108, borderRadius: 24, backgroundColor: t.color.bgAlt, gap: 4, marginHorizontal: pull, transform: [{ rotate }] }]}>
        <Text style={{ fontSize: 40, lineHeight: 46, fontWeight: '800', color: t.color.text }}>{letter}</Text>
        <Dot color={color} size={30}>
          <Icon size={17} color={t.color.iconOnSignal} />
        </Dot>
      </View>
    ))}
    <Spark t={t} left={104} top={8} size={10} />
  </View>
);

/** 3 — Four ways to plan: a planner page, days marked in different ways. (The four kinds themselves are the tiles below.) */
const Planner: Draw = ({ t }) => {
  const marks = [t.accent.fill, null, t.color.fallback, null, null, t.color.ideal, null, t.color.celebrationGold, null];
  return (
    <View style={s.canvas}>
      <View style={[s.tile, { width: 118, height: 122, borderRadius: 26, backgroundColor: t.color.bgAlt, justifyContent: 'flex-start', overflow: 'hidden', transform: [{ rotate: '-3deg' }] }]}>
        <View style={{ alignSelf: 'stretch', height: 30, backgroundColor: t.color.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 34 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color.bgAlt }} />
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color.bgAlt }} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 96, gap: 9, marginTop: 13 }}>
          {marks.map((color, i) => (
            <View key={i} style={{ width: 26, height: 18, borderRadius: 7, backgroundColor: color ?? t.color.surface }} />
          ))}
        </View>
      </View>
      <Spark t={t} left={184} top={26} />
      <Spark t={t} left={30} top={102} size={8} />
    </View>
  );
};

/** 4 — Every day counts: a week of days, ideal or fallback, and the bar they add up to. */
const WeekCounts: Draw = ({ t }) => {
  const week = ['ideal', 'ideal', 'fallback', 'ideal', 'off', 'fallback', 'ideal'] as const;
  return (
    <View style={s.canvas}>
      <View style={[s.tile, { width: 196, height: 104, borderRadius: 26, backgroundColor: t.color.bgAlt, paddingHorizontal: 16, gap: 14, alignItems: 'stretch', transform: [{ rotate: '-2deg' }] }]}>
        <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: t.color.surface }}>
          <View style={{ flex: 4, backgroundColor: t.color.ideal }} />
          <View style={{ flex: 2, backgroundColor: t.color.fallback }} />
          <View style={{ flex: 1, backgroundColor: t.color.off }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {week.map((state, i) => (
            <Dot key={i} size={20} color={state === 'ideal' ? t.color.ideal : state === 'fallback' ? t.color.fallback : t.color.surface}>
              {state === 'ideal' ? <CheckCheck size={12} color={t.color.iconOnSignal} /> : state === 'fallback' ? <Check size={12} color={t.color.iconOnSignal} /> : <Minus size={12} color={t.color.textMuted} />}
            </Dot>
          ))}
        </View>
      </View>
      <Spark t={t} left={196} top={14} size={10} />
    </View>
  );
};

/** 5 — Make it yours: your phone, with a brush on it. (The colors to pick are below.) */
const YourPhone: Draw = ({ t }) => (
  <View style={s.canvas}>
    <View style={{ width: 84, height: 132, borderRadius: 20, backgroundColor: t.color.bgAlt, padding: 9, gap: 8, transform: [{ rotate: '-5deg' }] }}>
      <View style={{ height: 40, borderRadius: 11, backgroundColor: t.accent.fill }} />
      <View style={{ height: 9, width: '80%', borderRadius: 5, backgroundColor: t.color.borderStrong }} />
      <View style={{ height: 9, width: '55%', borderRadius: 5, backgroundColor: t.color.border }} />
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
        <View style={{ flex: 1, height: 20, borderRadius: 8, backgroundColor: t.color.idealSoft }} />
        <View style={{ flex: 1, height: 20, borderRadius: 8, backgroundColor: t.color.fallbackSoft }} />
      </View>
    </View>
    <Dot color={t.color.bgAlt} size={54} style={{ position: 'absolute', left: 130, top: 70, borderWidth: 4, borderColor: t.accent.fill }}>
      <Paintbrush size={26} color={t.accent.text} />
    </Dot>
    <Spark t={t} left={46} top={24} />
    <Spark t={t} left={186} top={40} size={8} />
  </View>
);

/** 6 — Gentle nudges: one quiet notification. */
const Nudge: Draw = ({ t }) => (
  <View style={s.canvas}>
    <View style={[s.tile, { width: 200, height: 76, borderRadius: 24, backgroundColor: t.color.bgAlt, flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 14, gap: 12, transform: [{ rotate: '-3deg' }] }]}>
      <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: t.accent.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Bell size={24} color={t.accent.text} />
      </View>
      <View style={{ flex: 1, gap: 9 }}>
        <View style={{ width: '82%', height: 10, borderRadius: 5, backgroundColor: t.color.borderStrong }} />
        <View style={{ width: '56%', height: 10, borderRadius: 5, backgroundColor: t.color.border }} />
      </View>
    </View>
    <Dot color={t.color.celebrationGold} size={22} style={{ position: 'absolute', left: 192, top: 24, borderWidth: 3, borderColor: t.accent.fill }} />
  </View>
);

/** 7 — Add your first habit: the seed going in. Step 1 showed the plant it becomes. (The form is below.) */
const Seedling: Draw = ({ t }) => (
  <View style={s.canvas}>
    <View style={[s.tile, { width: 108, height: 108, borderRadius: 30, backgroundColor: t.color.bgAlt, transform: [{ rotate: '3deg' }] }]}>
      <Svg width={84} height={84} viewBox="0 0 84 84">
        <Path d="M20 50H64L59 74Q58 78 54 78H30Q26 78 25 74Z" fill={t.color.borderStrong} />
        <Rect x={16} y={44} width={52} height={10} rx={5} fill={t.color.text} />
        <Path d="M42 44V30" stroke={t.color.text} strokeWidth={4.5} strokeLinecap="round" />
        <Path d="M42 34C33 34 28 28 28 20 37 20 42 26 42 34Z" fill={t.color.ideal} />
        <Path d="M42 30C50 30 55 25 55 17 47 17 42 22 42 30Z" fill={t.color.fallback} />
      </Svg>
    </View>
    <Dot color={t.color.bgAlt} size={44} style={{ position: 'absolute', left: 142, top: 22, borderWidth: 4, borderColor: t.accent.fill }}>
      <Plus size={24} color={t.accent.text} />
    </Dot>
    <Spark t={t} left={30} top={30} size={10} />
  </View>
);

const DRAWINGS: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, Draw> = { 1: PlanAB, 2: Sprout, 3: Planner, 4: WeekCounts, 5: YourPhone, 6: Nudge, 7: Seedling };

const s = StyleSheet.create({
  canvas: { width: PICTURE_WIDTH, height: PICTURE_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
