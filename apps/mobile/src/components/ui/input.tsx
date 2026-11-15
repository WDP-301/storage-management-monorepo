import * as React from 'react';
import {
  Platform,
  Pressable,
  TextInput as RNTextInput,
  StyleSheet,
  type TextInputProps,
  View,
} from 'react-native';

import colors from './colors';
import { FieldLabel } from './field-label';
import { Icon, type IconName } from './icon';
import { InlineMessage } from './inline-message';
import { Text } from './text';
import { tv } from './tw-merge';

const inputTv = tv({
  slots: {
    container: 'gap-1',
    field: 'flex-row items-center gap-2 rounded-xl border border-transparent bg-bg-subtle px-4',
    input: 'flex-1 py-3 font-inter text-body text-text-primary',
    helper: 'text-caption text-text-secondary',
  },
  variants: {
    focused: {
      true: {
        field: 'border-border-focus',
      },
    },
    error: {
      true: {
        field: 'border-border-error',
      },
    },
    disabled: {
      true: {
        field: 'bg-action-disabled',
        input: 'text-text-disabled',
      },
    },
    multiline: {
      true: {
        field: 'items-start py-1',
        input: 'min-h-[88px]',
      },
      false: {
        field: 'min-h-[46px]',
      },
    },
  },
  defaultVariants: {
    focused: false,
    error: false,
    disabled: false,
    multiline: false,
  },
});

export type InputProps = {
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  passwordToggle?: boolean;
  clearable?: boolean;
  containerClassName?: string;
  ref?: React.Ref<RNTextInput>;
} & TextInputProps;

/** Techvera styled text input with focus ring, error inline message, clear & password toggles. */
export function Input({
  ref,
  label,
  required,
  disabled = false,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  leftSlot,
  rightSlot,
  passwordToggle = false,
  clearable = false,
  containerClassName,
  secureTextEntry,
  multiline = false,
  value,
  onChangeText,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  testID,
  ...inputProps
}: InputProps) {
  const [focused, setFocused] = React.useState(false);
  const [passwordHidden, setPasswordHidden] = React.useState(
    Boolean(secureTextEntry ?? passwordToggle),
  );

  const styles = inputTv({
    focused,
    error: Boolean(error),
    disabled,
    multiline,
  });

  const iconColor = disabled ? colors.semantic.textDisabled : colors.semantic.textSecondary;
  const effectiveSecure = passwordToggle ? passwordHidden : secureTextEntry;
  const showClear = clearable && !disabled && typeof value === 'string' && value.length > 0;

  return (
    <View className={styles.container({ className: containerClassName })}>
      {label ? (
        <FieldLabel required={required} testID={testID ? `${testID}-label` : undefined}>
          {label}
        </FieldLabel>
      ) : null}
      <View className={styles.field()}>
        {leftSlot ?? (leftIcon ? <Icon color={iconColor} name={leftIcon} /> : null)}
        <RNTextInput
          ref={ref}
          className={styles.input()}
          editable={!disabled}
          multiline={multiline}
          onBlur={(e) => {
            setFocused(false);
            onBlurProp?.(e);
          }}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocused(true);
            onFocusProp?.(e);
          }}
          placeholderTextColor={colors.semantic.textPlaceholder}
          secureTextEntry={effectiveSecure}
          style={StyleSheet.flatten([
            Platform.OS === 'web' && webStyles.noOutline,
            multiline && { textAlignVertical: 'top' },
            inputProps.style,
          ])}
          testID={testID}
          value={value}
          {...inputProps}
        />
        {showClear ? (
          <Pressable
            accessibilityLabel="Xóa nội dung"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => onChangeText?.('')}
          >
            <Icon color={iconColor} name="close" size={18} />
          </Pressable>
        ) : null}
        {passwordToggle ? (
          <Pressable
            accessibilityLabel={passwordHidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setPasswordHidden((prev) => !prev)}
          >
            <Icon
              color={iconColor}
              name={passwordHidden ? 'visibility' : 'visibility-off'}
              size={20}
            />
          </Pressable>
        ) : null}
        {rightSlot}
        {rightIcon ? (
          <Pressable
            disabled={!onRightIconPress}
            hitSlop={12}
            onPress={onRightIconPress}
            testID={testID ? `${testID}-right-icon` : undefined}
          >
            <Icon color={iconColor} name={rightIcon} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <InlineMessage
          message={error}
          testID={testID ? `${testID}-error` : undefined}
          type="error"
        />
      ) : helperText ? (
        <Text className={styles.helper()} testID={testID ? `${testID}-helper` : undefined}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const webStyles = StyleSheet.create({
  noOutline: { outlineWidth: 0 },
});
