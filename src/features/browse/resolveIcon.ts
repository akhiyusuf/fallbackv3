import * as LucideIcons from 'lucide-react-native';
import { Repeat } from 'lucide-react-native';

import { ACCENTS } from '@/theme';
import type { TaskColor } from '@/types';
import type { IconComponent } from '@/ui';

export function resolveTaskIcon(name: string | null | undefined): IconComponent {
  if (!name) return Repeat;
  const found = (LucideIcons as unknown as Record<string, IconComponent>)[name];
  return found ?? Repeat;
}

/** The circle color for a task (D14). */
export function taskColor(color: TaskColor | null | undefined): string {
  return (ACCENTS[color ?? 'forge-orange'] ?? ACCENTS['forge-orange']).base;
}

/** Props for <TaskIcon> from a task. */
export function taskIconProps(task: { readonly icon: string | null | undefined; readonly color: TaskColor | null | undefined }): {
  readonly icon: IconComponent;
  readonly color: string;
} {
  return { icon: resolveTaskIcon(task.icon), color: taskColor(task.color) };
}
