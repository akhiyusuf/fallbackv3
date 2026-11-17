/**
 * The picture in each onboarding step's banner, as bundled files (cut-outs with transparent
 * backgrounds; sources and how they were made are in docs/design-rebuild/banners/).
 */
import type { ImageSourcePropType } from 'react-native';

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/* eslint-disable @typescript-eslint/no-require-imports */
export const BANNER_IMAGES: Record<OnboardingStep, ImageSourcePropType> = {
  1: require('../../../assets/onboarding/banner_1.webp') as ImageSourcePropType,
  2: require('../../../assets/onboarding/banner_2.webp') as ImageSourcePropType,
  3: require('../../../assets/onboarding/banner_3.webp') as ImageSourcePropType,
  4: require('../../../assets/onboarding/banner_4.webp') as ImageSourcePropType,
  5: require('../../../assets/onboarding/banner_5.webp') as ImageSourcePropType,
  6: require('../../../assets/onboarding/banner_6.webp') as ImageSourcePropType,
  7: require('../../../assets/onboarding/banner_7.webp') as ImageSourcePropType,
};

/** Each picture's width over its height (from the files), so the banner can size it exactly. */
export const BANNER_ASPECT: Record<OnboardingStep, number> = {
  1: 960 / 547,
  2: 423 / 640,
  3: 960 / 388,
  4: 960 / 384,
  5: 644 / 640,
  6: 943 / 640,
  7: 544 / 640,
};
