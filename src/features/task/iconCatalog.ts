/**
 * M4 — S21's icon grid (IDEA Flow 8.5's four categories: Fitness / Health / Work / Study).
 * Lucide icon components only, mapped through `@/ui`'s `IconComponent` shape so nothing here
 * hand-rolls SVG.
 */
import {
  Activity,
  Bike,
  Book,
  BookOpen,
  Briefcase,
  Building2,
  Dumbbell,
  FileText,
  Footprints,
  GraduationCap,
  HeartPulse,
  Laptop,
  Library,
  PenTool,
  Pill,
  Repeat,
  Stethoscope,
} from 'lucide-react-native';

import type { IconComponent } from '@/ui/icon';

export interface IconCatalogEntry {
  readonly name: string;
  readonly icon: IconComponent;
}

export interface IconCategory {
  readonly heading: string;
  readonly icons: readonly IconCatalogEntry[];
}

export const ICON_CATEGORIES: readonly IconCategory[] = [
  {
    heading: 'Fitness',
    icons: [
      { name: 'Dumbbell', icon: Dumbbell },
      { name: 'Bike', icon: Bike },
      { name: 'Footprints', icon: Footprints },
      { name: 'Activity', icon: Activity },
      { name: 'Repeat', icon: Repeat },
    ],
  },
  {
    heading: 'Health',
    icons: [
      { name: 'HeartPulse', icon: HeartPulse },
      { name: 'Pill', icon: Pill },
      { name: 'Stethoscope', icon: Stethoscope },
    ],
  },
  {
    heading: 'Work',
    icons: [
      { name: 'Briefcase', icon: Briefcase },
      { name: 'Laptop', icon: Laptop },
      { name: 'FileText', icon: FileText },
      { name: 'Building2', icon: Building2 },
    ],
  },
  {
    heading: 'Study',
    icons: [
      { name: 'BookOpen', icon: BookOpen },
      { name: 'GraduationCap', icon: GraduationCap },
      { name: 'PenTool', icon: PenTool },
      { name: 'Library', icon: Library },
      { name: 'Book', icon: Book },
    ],
  },
];

/** Every catalog entry, flattened — used to resolve a task's stored `icon` name back to a component. */
export const ALL_ICONS: readonly IconCatalogEntry[] = ICON_CATEGORIES.flatMap((c) => c.icons);

export function iconByName(name: string): IconComponent {
  return ALL_ICONS.find((e) => e.name === name)?.icon ?? Repeat;
}

/** Live search filter (S21) — case-insensitive substring match on icon name, category-preserving. */
export function filterIconCategories(query: string): readonly IconCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICON_CATEGORIES;
  return ICON_CATEGORIES.map((c) => ({ ...c, icons: c.icons.filter((i) => i.name.toLowerCase().includes(q)) })).filter(
    (c) => c.icons.length > 0,
  );
}
