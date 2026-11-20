/**
 * OnboardingShell — the ONE top bar and layout for all seven onboarding steps
 * (D6): back on the left (hidden on step 1), one dot per step centred, Skip on
 * the right. The main action is pinned at the bottom (D8).
 */
import type { ReactNode } from 'react';
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
// The screen's own navigation, read without throwing when there is none (a test renders the shell alone).
import { NavigationContext } from 'expo-router/build/react-navigation/core';
import { AccessibilityInfo, Animated, BackHandler, Easing, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { now } from '@/lib/date';
import { useToastStore } from '@/app-shell/stores/toast';
import { useUpdateSettings } from '@/queries';
import { FONT_SIZE, HEADER_HEIGHT, RADIUS, SPACE, useTheme } from '@/theme';
import { Button, useReduceMotion } from '@/ui';
import type { IconComponent } from '@/ui';

import { ONBOARDING_SHELL_COPY } from './copy';
import { BANNER_ASPECT, BANNER_IMAGES } from './bannerImages';
import { ONBOARDING_NEEDS } from './onboardingNeeds';
import { OnboardingPicture, PICTURE_HEIGHT, PICTURE_WIDTH } from './OnboardingPicture';
import { finishOnboardingProgress, leaveOnboarding } from './useOnboardingResume';
import { Text } from '@/ui/AppText';

export const ONBOARDING_TOTAL_STEPS = 7;

/**
 * How much room the step has. Every onboarding step must fit its screen without scrolling, so
 * on a shorter screen the type and the gaps tighten ("compact", then "tight") and the picture
 * gives up its height first. Steps read this to tighten their own content the same way.
 */
export type OnboardingDensity = 'regular' | 'compact' | 'tight';
// Held outside React so a step's own screen (which renders the shell, so sits above it) can read it.
let currentDensity: OnboardingDensity = 'regular';
const densityListeners = new Set<() => void>();
function publishDensity(next: OnboardingDensity) {
  if (next === currentDensity) return;
  currentDensity = next;
  densityListeners.forEach((fn) => fn());
}
export function useOnboardingDensity(): OnboardingDensity {
  return useSyncExternalStore(
    (fn) => {
      densityListeners.add(fn);
      return () => densityListeners.delete(fn);
    },
    () => currentDensity,
    () => currentDensity,
  );
}
/**
 * Every step's banner (the colored top) is the same height, so the words start at the same
 * place on all seven steps and no picture is smaller than another. That height is what the
 * fullest step leaves free, up to BANNER_SHARE of the screen. To keep it generous the type and
 * the gaps tighten on ALL steps together ("compact", then "tight"): a roomier setting is used
 * only when it costs the banner almost nothing (NEAR). A step with less below its words (step 5
 * most of all) leaves its spare room above the button; its banner stays the same as the rest.
 *
 * ONBOARDING_NEEDS is the height each step needs below the banner (words, example, buttons),
 * measured in the built app by docs/design-rebuild/preview-harness/obneed.js. Re-measure after
 * changing any step's content or these styles.
 */
const BANNER_SHARE = 0.36;
const NEAR = 0.92;
// Room kept spare so a slightly wider typeface on a real phone does not push a step into scrolling.
const NEED_SLACK = 8;
const DENSITIES: readonly OnboardingDensity[] = ['regular', 'compact', 'tight'];
function needsAt(density: OnboardingDensity, width: number): readonly number[] {
  const rows = ONBOARDING_NEEDS[density];
  let found = rows[0]!;
  for (const row of rows) if (width >= row[0]!) found = row;
  return found.slice(1);
}
interface Plan {
  readonly density: OnboardingDensity;
  /** Height of the whole top (bar and banner) on every step, before the phone's top inset. */
  readonly top: number;
}
function planFor(height: number, width: number): Plan {
  const cap = Math.round(height * BANNER_SHARE);
  const room = (d: OnboardingDensity) => Math.min(cap, height - Math.max(...needsAt(d, width)) - NEED_SLACK);
  const best = room('tight');
  // Only for the measuring script, which has to see each setting at any window size.
  const forced = (globalThis as { __obDensity?: OnboardingDensity }).__obDensity;
  const density = forced ?? DENSITIES.find((d) => room(d) >= best * NEAR) ?? 'tight';
  return { density, top: Math.max(HEADER_HEIGHT, room(density)) };
}
// Room kept around a picture: a little air above, more below so a cut-out never touches the banner's
// rounded bottom edge, and side margins that keep a wide picture clear of the back and skip buttons.
const PICTURE_TOP = 6;
const PICTURE_BOTTOM = 16;
const PICTURE_SIDE = 28;
const DOT_SIZE = 8;
const DOT_ACTIVE = 20;
// The step shown last, so the next one knows which way the person is going.
let lastShownStep = 0;
// The height the top had on the step the person just left, so the next one can start from it.
let lastTopHeight: number | null = null;

const PREVIOUS: Record<number, string> = {
  2: '/onboarding/concept',
  3: '/onboarding/hook',
  4: '/onboarding/types',
  5: '/onboarding/consistency',
  6: '/onboarding/personalize',
  7: '/onboarding/notifications-primer',
};

export interface OnboardingShellProps {
  readonly step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly icon?: IconComponent;
  readonly headline: string;
  readonly body: string;
  readonly onNext?: () => void;
  readonly nextLabel?: string;
  readonly nextDisabled?: boolean;
  readonly nextLoading?: boolean;
  /** Replace the default single button (e.g. the Allow / Not now pair). */
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
}

export function OnboardingShell({ step, icon: Icon, headline, body, onNext, nextLabel = ONBOARDING_SHELL_COPY.next, nextDisabled = false, nextLoading = false, footer, children }: OnboardingShellProps) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);
  // The real height of this screen (in a phone it equals the window; in a frame it does not).
  const windowHeight = useWindowDimensions().height;
  const [height, setHeight] = useState(windowHeight);
  const [width, setWidth] = useState(0);
  const [pictureRoom, setPictureRoom] = useState(0);
  const [pictureRoomWidth, setPictureRoomWidth] = useState(0);
  const windowWidth = useWindowDimensions().width;
  // The measured needs are for a screen with no insets; the phone's own insets come off the room first.
  const plan = planFor(height - insets.top - insets.bottom, width > 0 ? width : windowWidth);
  const density = plan.density;
  useEffect(() => publishDensity(density), [density]);
  const barAndInset = HEADER_HEIGHT + insets.top;
  const target = plan.top + insets.top;
  const reduced = useReduceMotion();
  // Moving between steps eases from the banner the person was just looking at to this one.
  const basis = useState(() => new Animated.Value(lastTopHeight ?? target))[0];
  useEffect(() => {
    if (reduced) {
      basis.setValue(target);
      return;
    }
    const run = Animated.timing(basis, { toValue: target, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [basis, reduced, target]);
  // Moving between steps does not swap the whole page. The banner and the button stay where they
  // are; the new picture springs in from the side the person is heading, and the words rise into
  // place one after another. Going back plays it the other way. Reduced motion shows it all at once.
  const pictureIn = useState(() => new Animated.Value(0))[0];
  const headlineIn = useState(() => new Animated.Value(0))[0];
  const bodyIn = useState(() => new Animated.Value(0))[0];
  const restIn = useState(() => new Animated.Value(0))[0];
  const activeDot = useState(() => new Animated.Value(DOT_ACTIVE))[0];
  const [direction, setDirection] = useState(() => (step >= lastShownStep ? 1 : -1));
  const entrance = useRef<Animated.CompositeAnimation | null>(null);
  function playEntrance() {
    lastShownStep = step;
    entrance.current?.stop();
    const parts = [pictureIn, headlineIn, bodyIn, restIn];
    if (reduced) {
      parts.forEach((v) => v.setValue(1));
      activeDot.setValue(DOT_ACTIVE);
      return;
    }
    parts.forEach((v) => v.setValue(0));
    activeDot.setValue(DOT_SIZE);
    const rise = (v: Animated.Value, delay: number) =>
      Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    entrance.current = Animated.parallel([
      Animated.spring(pictureIn, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      rise(headlineIn, 60),
      rise(bodyIn, 130),
      rise(restIn, 200),
      Animated.timing(activeDot, { toValue: DOT_ACTIVE, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    entrance.current.start();
  }
  useEffect(() => {
    playEntrance();
    return () => entrance.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Coming back to a step (Back, or the phone's back gesture) plays it again, from the other side.
  const navigation = useContext(NavigationContext);
  const playRef = useRef(playEntrance);
  useEffect(() => {
    playRef.current = playEntrance;
  });
  useEffect(() => {
    if (!navigation) return;
    let left = false;
    const offBlur = navigation.addListener('blur', () => {
      left = true;
    });
    const offFocus = navigation.addListener('focus', () => {
      if (left) {
        setDirection(step >= lastShownStep ? 1 : -1);
        playRef.current();
      }
      left = false;
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation, step]);
  const slide = (v: Animated.Value, distance: number) => ({
    opacity: v,
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [direction * distance, 0] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
    ],
  });
  const image = BANNER_IMAGES[step];
  // The picture gets an exact size, worked out here, and the room centres it. Left to an image's
  // own "fit inside" rule, Android drew some pictures against one side of the banner.
  const aspect = BANNER_ASPECT[step];
  const fitWidth = Math.max(0, Math.min(pictureRoomWidth - PICTURE_SIDE * 2, (pictureRoom - PICTURE_TOP - PICTURE_BOTTOM) * aspect));
  const pictureScale = Math.min(1.6, (pictureRoom - 12) / PICTURE_HEIGHT, width > 0 ? (width - 48) / PICTURE_WIDTH : 1.2);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Step ${step} of ${ONBOARDING_TOTAL_STEPS}. ${headline}`);
  }, [step, headline]);

  const skipping = useRef(false);
  async function handleSkip() {
    if (skipping.current) return;
    skipping.current = true;
    try {
      await skip();
    } finally {
      skipping.current = false;
    }
  }
  async function skip() {
    // Wait for the save: leaving without it would bring onboarding back on the next launch.
    const saved = await updateSettings.mutateAsync({ onboardingCompletedAt: now() }).catch(() => ({ ok: false as const }));
    if (!saved.ok) {
      showToast(ONBOARDING_SHELL_COPY.skipFailure, 'warning');
      return;
    }
    await finishOnboardingProgress();
    leaveOnboarding(router, '/today' as Href);
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace((PREVIOUS[step] ?? '/onboarding/concept') as Href);
  }
  // After a resume the step is the only screen in the stack, so the phone's own back button would
  // leave the app from step 4. Make it go to the step before, like the on-screen Back.
  useEffect(() => {
    if (step === 1) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;
      router.replace((PREVIOUS[step] ?? '/onboarding/concept') as Href);
      return true;
    });
    return () => sub.remove();
  }, [router, step]);

  return (
    // Step 7 is a form: pad by the keyboard so its fields and Save stay above it (see `Screen`).
    <KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: t.color.bg }]} onLayout={(e) => {
      // A step left behind in the stack is hidden and reports 0: never let that set the density.
      const h = e.nativeEvent.layout.height;
      if (h > 0) {
        setHeight(h);
        setWidth(e.nativeEvent.layout.width);
      }
    }}>
      <Animated.View
        style={[styles.top, { backgroundColor: t.accent.fill, paddingTop: insets.top, flexBasis: basis, minHeight: barAndInset }]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) lastTopHeight = h;
        }}
      >
      <View style={styles.bar}>
        <View style={styles.side}>
          {step > 1 ? (
            <Pressable onPress={handleBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={6} style={[styles.round, { backgroundColor: t.color.bgAlt }]}>
              <ChevronLeft size={22} color={t.color.text} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.dots} accessibilityLabel={`Step ${step} of ${ONBOARDING_TOTAL_STEPS}`}>
          {Array.from({ length: ONBOARDING_TOTAL_STEPS }, (_, i) => i + 1).map((dot) => (
            <Animated.View
              key={dot}
              testID={`onboarding-dot-${dot}`}
              style={[styles.dot, { backgroundColor: t.accent.onLarge, opacity: dot === step ? 1 : dot < step ? 0.75 : 0.4, width: dot === step ? activeDot : DOT_SIZE }]}
            />
          ))}
        </View>
        <View style={[styles.side, styles.sideRight]}>
          <Pressable onPress={() => void handleSkip()} accessibilityRole="button" accessibilityLabel="Skip onboarding" hitSlop={8} style={[styles.skip, { backgroundColor: t.color.bgAlt }]}>
            <Text style={[styles.skipLabel, { color: t.color.text }]}>{ONBOARDING_SHELL_COPY.skip}</Text>
          </Pressable>
        </View>
      </View>
      <View
        style={styles.pictureRoom}
        onLayout={(e) => {
          setPictureRoom(e.nativeEvent.layout.height);
          setPictureRoomWidth(e.nativeEvent.layout.width);
        }}
      >
        {pictureRoom < 44 ? null : image ? (
          fitWidth > 0 ? (
            <Animated.View
              style={{
                opacity: pictureIn,
                transform: [
                  { translateX: pictureIn.interpolate({ inputRange: [0, 1], outputRange: [direction * 36, 0] }) },
                  { scale: pictureIn.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
                ],
              }}
            >
            <Image
              source={image}
              resizeMode="contain"
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{ width: fitWidth, height: fitWidth / aspect, marginTop: PICTURE_TOP, marginBottom: PICTURE_BOTTOM }}
            />
            </Animated.View>
          ) : null
        ) : (
          <OnboardingPicture step={step} scale={pictureScale} />
        )}
      </View>
      </Animated.View>
      <ScrollView alwaysBounceVertical={false} overScrollMode="auto" style={styles.body} contentContainerStyle={[styles.content, density !== 'regular' && styles.contentCompact, density === 'tight' && styles.contentTight]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View style={slide(headlineIn, 24)}>
          <Text accessibilityRole="header" style={[styles.headline, density === 'compact' && styles.headlineCompact, density === 'tight' && styles.headlineTight, { color: t.color.text }]}>
            {headline}
          </Text>
        </Animated.View>
        <Animated.View style={slide(bodyIn, 24)}>
          <Text style={[styles.bodyText, density === 'tight' && styles.bodyTight, { color: t.color.textMuted }]}>{body}</Text>
        </Animated.View>
        <Animated.View style={[styles.children, density !== 'regular' && styles.childrenCompact, density === 'tight' && styles.childrenTight, slide(restIn, 24)]}>{children}</Animated.View>
      </ScrollView>
      {/* Whatever room the banner does not take sits here, above the button. */}
      <View style={styles.flex} />

      <View style={[styles.footer, density !== 'regular' && styles.footerCompact, { paddingBottom: (density === 'regular' ? SPACE.s3 : SPACE.s2 + 4) + insets.bottom, borderTopColor: t.color.border, backgroundColor: t.color.bgAlt }]}>
        {footer ?? <Button label={nextLabel} onPress={onNext ?? (() => undefined)} disabled={nextDisabled} loading={nextLoading} accessibilityLabel={nextLabel} fullWidth />}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  // The top gives up its height before anything below has to scroll.
  top: { flexGrow: 0, flexShrink: 1000, overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  pictureRoom: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  body: { flexGrow: 0, flexShrink: 1, flexBasis: 'auto' },
  bar: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.s2 + 4 },
  round: { width: 40, height: 40, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  side: { width: 72, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end' },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: RADIUS.pill },
  skip: { minHeight: 36, borderRadius: RADIUS.pill, justifyContent: 'center', paddingHorizontal: SPACE.s3 },
  skipLabel: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  content: { paddingHorizontal: SPACE.s3, paddingTop: SPACE.s4, paddingBottom: SPACE.s5, gap: SPACE.s2 },
  headline: { fontSize: FONT_SIZE.xxl, fontWeight: '800', lineHeight: 38 },
  headlineCompact: { fontSize: 26, lineHeight: 32 },
  headlineTight: { fontSize: 22, lineHeight: 27 },
  bodyText: { fontSize: FONT_SIZE.base, lineHeight: 24 },
  bodyTight: { fontSize: 14, lineHeight: 20 },
  contentCompact: { paddingTop: SPACE.s3, paddingBottom: SPACE.s3, gap: SPACE.s1 + 2 },
  childrenCompact: { gap: SPACE.s2 + 4, marginTop: SPACE.s2 },
  contentTight: { paddingTop: SPACE.s2 + 4, paddingBottom: SPACE.s2 + 2, gap: SPACE.s1 },
  childrenTight: { gap: SPACE.s2 + 2, marginTop: SPACE.s1 + 2 },
  footerCompact: { paddingTop: SPACE.s2 + 4 },
  children: { gap: SPACE.s3, marginTop: SPACE.s3 },
  footer: { paddingHorizontal: SPACE.s3, paddingTop: SPACE.s3, borderTopWidth: 1, gap: SPACE.s2 },
});
