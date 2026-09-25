import React, { useId } from 'react';

export interface TextFieldProps {
  children: React.ReactNode;
  isInvalid?: boolean;
  isRequired?: boolean;
  className?: string;
}

export const TextField: React.FC<TextFieldProps> = ({
  children,
  isInvalid = false,
  isRequired = false,
  className = '',
}) => {
  return (
    <div
      data-invalid={isInvalid ? 'true' : undefined}
      data-required={isRequired ? 'true' : undefined}
      className={`flex flex-col gap-1.5 ${className}`}
    >
      {children}
    </div>
  );
};

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  isRequired?: boolean;
}

export const Label: React.FC<LabelProps> = ({ isRequired, children, className = '', ...props }) => {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Reusable label element passes htmlFor dynamically
    <label
      className={`text-sm font-semibold text-foreground flex items-center gap-1 ${className}`}
      {...props}
    >
      {children}
      {isRequired && (
        <span className="text-danger" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ isInvalid, leftIcon, rightIcon, className = '', ...props }, ref) => {
    const id = useId();
    const inputId = props.id || id;

    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-muted">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full min-h-[44px] px-3.5 text-sm bg-surface text-foreground border rounded-lg transition-colors placeholder:text-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent disabled:opacity-50 disabled:bg-surface-secondary ${
            leftIcon ? 'pl-10' : ''
          } ${rightIcon ? 'pr-10' : ''} ${
            isInvalid
              ? 'border-danger focus-visible:ring-danger'
              : 'border-border hover:border-muted/50'
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 flex items-center text-muted">{rightIcon}</div>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export const FieldError: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  if (!children) return null;
  return (
    <p role="alert" className={`text-xs font-medium text-danger leading-tight mt-0.5 ${className}`}>
      {children}
    </p>
  );
};

export const HelperText: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  if (!children) return null;
  return <p className={`text-xs text-muted leading-tight mt-0.5 ${className}`}>{children}</p>;
};
