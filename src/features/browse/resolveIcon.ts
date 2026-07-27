/** M3. Resolves a task's stored Lucide icon name (S21's free-text `IconName`) to a component. */
import * as LucideIcons from 'lucide-react-native';
import { Repeat } from 'lucide-react-native';

import type { IconComponent } from '@/ui';

export function resolveTaskIcon(name: string | null | undefined): IconComponent {
  if (!name) return Repeat;
  const found = (LucideIcons as unknown as Record<string, IconComponent>)[name];
  return found ?? Repeat;
}
