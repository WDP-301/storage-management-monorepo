import * as React from 'react';
import { ActivityIndicator, Pressable, type PressableProps, type View } from 'react-native';
import type { VariantProps } from 'tailwind-variants';

import colors from './colors';
import { Icon, type IconName } from './icon';
import { Text } from './text';
import { tv } from './tw-merge';

const buttonTv = tv({
  slots: {
    container: 'flex-row items-center justify-center gap-2 rounded-3xl',
    label: 'font-inter text-body font-semibold',
  },
  variants: {
    variant: {
      primary: {
        container: 'bg-action-primary',
        label: 'text-text-inverse',
      },
      secondary: {
        container: 'bg-action-neutral',
        label: 'text-text-primary',
      },
      text: {
        container: 'bg-transparent',
        label: 'text-text-link',
      },
      outline: {
        container: 'border border-border-strong bg-transparent',
        label: 'text-text-primary',
      },
      destructive: {
        container: 'bg-danger-500',
        label: 'text-text-inverse',
      },
    },
    pressed: {
      true: {},
    },
    size: {
      default: {
        container: 'h-[46px] px-6',
      },
      lg: {
        container: 'h-14 px-8',
      },
      sm: {
        container: 'h-9 px-4',
        label: 'text-caption',
      },
      icon: {
        container: 'size-11 p-0',
      },
    },
    disabled: {
      true: {
        label: 'text-text-disabled',
      },
    },
    fullWidth: {
      true: {
        container: 'w-full',
      },
      false: {
        container: 'self-start',
      },
    },
  },
  compoundVariants: [
    { variant: 'primary', pressed: true, className: { container: 'bg-action-primary-pressed' } },
    { variant: 'secondary', pressed: true, className: { container: 'bg-action-neutral-pressed' } },
    { variant: 'text', pressed: true, className: { container: 'bg-bg-subtle' } },
    { variant: 'outline', pressed: true, className: { container: 'bg-bg-subtle' } },
    { variant: 'destructive', pressed: true, className: { container: 'bg-danger-600' } },
    {
      variant: ['primary', 'secondary', 'destructive'],
      disabled: true,
      className: { container: 'bg-action-disabled' },
    },
    { variant: 'outline', disabled: true, className: { container: 'border-border-divider' } },
  ],
  defaultVariants: {
    variant: 'primary',
    pressed: false,
    disabled: false,
    fullWidth: true,
    size: 'default',
  },
});

const contentColor = {
  primary: colors.semantic.textInverse,
  secondary: colors.semantic.textPrimary,
  text: colors.semantic.textLink,
  outline: colors.semantic.textPrimary,
  destructive: colors.semantic.textInverse,
} as const;

type ButtonVariants = Omit<VariantProps<typeof buttonTv>, 'pressed'>;

type Props = {
  label?: string;
  loading?: boolean;
  className?: string;
  textClassName?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  ref?: React.Ref<View>;
} & ButtonVariants &
  Omit<PressableProps, 'disabled'>;

/** Medipay pill button (`rounded-3xl`) with loading, icon, and destructive variants. */
export function Button({
  ref,
  label,
  loading = false,
  variant = 'primary',
  disabled = false,
  size = 'default',
  fullWidth,
  className = '',
  textClassName = '',
  leftIcon,
  rightIcon,
  onPressIn,
  onPressOut,
  children,
  testID,
  ...props
}: Props) {
  const [pressed, setPressed] = React.useState(false);
  const resolvedFullWidth =
    fullWidth ?? (!className.includes('flex-1') && size !== 'sm' && size !== 'icon');
  const styles = React.useMemo(
    () => buttonTv({ variant, disabled, size, fullWidth: resolvedFullWidth, pressed }),
    [variant, disabled, size, resolvedFullWidth, pressed],
  );
  const color = disabled ? colors.semantic.textDisabled : contentColor[variant ?? 'primary'];
  const iconSize = size === 'sm' ? 16 : 20;

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      className={styles.container({ className })}
      disabled={disabled || loading}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      testID={testID}
      {...props}
    >
      {children ? (
        children
      ) : loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <>
          {leftIcon ? <Icon color={color} name={leftIcon} size={iconSize} /> : null}
          {label ? (
            <Text className={styles.label({ className: textClassName })} numberOfLines={1}>
              {label}
            </Text>
          ) : null}
          {rightIcon ? <Icon color={color} name={rightIcon} size={iconSize} /> : null}
        </>
      )}
    </Pressable>
  );
}
