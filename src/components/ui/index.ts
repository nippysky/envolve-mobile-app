/**
 * UI primitive barrel.
 *
 * Screens import from '@/components/ui' — never from individual files — so the
 * surface area of the design system is one obvious import.
 */

export { Text }      from './Text';
export type { TextProps, TextVariant, TextTone } from './Text';

export { Pressable } from './Pressable';
export type { PressableProps, HapticStrength }   from './Pressable';

export { Surface }   from './Surface';
export type { SurfaceProps, SurfaceElevation }   from './Surface';

export { Button }    from './Button';
export type { ButtonProps }                      from './Button';

export { Input }     from './Input';
export type { InputProps }                       from './Input';

export { Badge, StatusBadge } from './Badge';
export type { BadgeProps }    from './Badge';

export { Skeleton, RowSkeleton, ProductCardSkeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { Icon }               from './Icon';
export type { IconName }      from './Icon';

export { EmptyState }         from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { QuantityStepper }    from './QuantityStepper';
export type { QuantityStepperProps } from './QuantityStepper';

export { ToastHost, toastConfig } from './Toast';

export { TabBar }           from '@/components/navigation/TabBar';
export type { TabConfig }   from '@/components/navigation/TabBar';
