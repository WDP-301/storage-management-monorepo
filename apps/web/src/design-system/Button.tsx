import { Loader2 } from 'lucide-react';
import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none active:scale-[0.98]';

    const sizeStyles = {
      sm: 'min-h-[36px] px-3 text-xs gap-1.5',
      md: 'min-h-[44px] px-4 text-sm gap-2', // Standard 44px touch/click target
      lg: 'min-h-[48px] px-6 text-base gap-2.5',
    }[size];

    const variantStyles = {
      primary:
        'bg-accent text-accent-foreground hover:opacity-90 shadow-xs border border-transparent',
      secondary:
        'bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border',
      outline: 'bg-surface text-foreground border border-border hover:bg-surface-secondary',
      ghost: 'bg-transparent text-muted hover:text-foreground hover:bg-surface-secondary',
      danger: 'bg-danger text-danger-foreground hover:opacity-90 border border-transparent',
    }[variant];

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-current" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
