/** M0 kit — shared shape for a Lucide icon component, used across kit props. */
import type { ComponentType } from 'react';

export interface IconProps {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly accessibilityElementsHidden?: boolean;
  readonly importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
}

export type IconComponent = ComponentType<IconProps>;
