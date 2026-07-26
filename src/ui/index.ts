/**
 * M0. The component kit. Every screen composes from here; no module defines its own
 * button/card/chip. Components are transcribed from the approved design system —
 * Verdant primitives plus the Fallback-custom components the handoff introduces.
 */
export { ScreenStub } from './ScreenStub';

export type { IconComponent, IconProps } from './icon';
/** The kit's one canonical screen-reader-only idiom — see the file header for why both halves matter. */
export { SR_ONLY_PROPS, SR_ONLY_STYLE } from './a11y';

// Verdant primitives
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { IconButton, type IconButtonProps } from './IconButton';
export { Card, type CardProps } from './Card';
export { Input, type InputProps } from './Input';
export { Textarea, type TextareaProps } from './Textarea';
export { Select, type SelectProps, type SelectOption } from './Select';
export { Switch, type SwitchProps } from './Switch';
export { RadioGroup as Radio, type RadioGroupProps as RadioProps, type RadioOption } from './Radio';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { Badge, type BadgeProps } from './Badge';
export { Tabs, type TabsProps, type TabItem } from './Tabs';
export { Dialog, type DialogProps } from './Dialog';
export { Toast } from './Toast';
export { ProgressRing, type ProgressRingProps } from './ProgressRing';

// Fallback-custom components (design-input README "Custom components")
export { StateChip, type StateChipProps } from './StateChip';
export { OffDayToggle, type OffDayToggleProps } from './OffDayToggle';
export { BottomTabs, type BottomTabsProps, type BottomTabsItem } from './BottomTabs';
export { ConsistencyBreakdownBar, type ConsistencyBreakdownBarProps } from './ConsistencyBreakdownBar';
export { ConsistencyRing, type ConsistencyRingProps } from './ConsistencyRing';
export { MilestoneBadge, type MilestoneBadgeProps } from './MilestoneBadge';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Skeleton, type SkeletonProps } from './Skeleton';
export { InlineRetryBanner, type InlineRetryBannerProps } from './InlineRetryBanner';
export { Tag, type TagProps } from './Tag';
export { CalendarHeatmap, type CalendarHeatmapProps, type CalendarHeatmapDay } from './CalendarHeatmap';
export { WeekdayPicker, type WeekdayPickerProps } from './WeekdayPicker';
export { CadencePicker, type CadencePickerProps } from './CadencePicker';
export { SubStepScheduleGrid, type SubStepScheduleGridProps, type SubStepScheduleGridStep } from './SubStepScheduleGrid';
export { XPBar, type XPBarProps } from './XPBar';
export { TrendGraph, type TrendGraphProps, type TrendGraphPoint } from './TrendGraph';
export { AsNeededCard, type AsNeededCardProps } from './AsNeededCard';
