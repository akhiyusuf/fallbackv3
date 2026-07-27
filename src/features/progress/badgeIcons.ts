/**
 * M5 — per-badge glyphs for `MilestoneBadge` (S27/S29/S30). `MilestoneBadge`'s own contract
 * (src/ui/MilestoneBadge.tsx) requires a per-badge `icon` prop — "never a single hardcoded
 * glyph" — so every key in `ACHIEVEMENTS` (@/domain) needs an entry here.
 */
import {
  Award,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Crown,
  Flag,
  Footprints,
  Gem,
  GraduationCap,
  Hourglass,
  Medal,
  PartyPopper,
  PiggyBank,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Sunrise,
  Trophy,
} from 'lucide-react-native';

import type { IconComponent } from '@/ui';

export const BADGE_ICONS: Record<string, IconComponent> = {
  'showing-up-7': Sunrise,
  'showing-up-30': CalendarClock,
  'showing-up-50': Footprints,
  'showing-up-200': Trophy,
  'fallback-safety-net': ShieldCheck,
  'fallback-never-zero': Shield,
  'fallback-saved-25': PiggyBank,
  'fallback-comeback': RotateCcw,
  'milestone-100-done': Star,
  'milestone-course-x3': GraduationCap,
  'milestone-full-week': CalendarDays,
  'tenure-first-day': Flag,
  'tenure-1-week': Calendar,
  'tenure-1-month': CalendarRange,
  'tenure-2-months': CalendarRange,
  'tenure-6-months': Hourglass,
  'tenure-1-year': PartyPopper,
  'tenure-2-years': Gem,
  'tenure-5-years': Award,
  'tenure-10-years': Medal,
  'tenure-20-years': Crown,
  'tenure-50-years': Sparkles,
};

/** Generic celebratory glyph for a level-up (not tied to any single achievement key). */
export const LEVEL_UP_ICON: IconComponent = Award;
