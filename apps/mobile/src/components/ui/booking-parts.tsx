import type * as React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from './colors';
import { Icon, type IconName } from './icon';
import { Text } from './text';

/** Pinned bottom bar container for dual/primary footer actions (Medipay BottomBar). */
export function BottomBar({
  children,
  className = '',
  insetBottom = true,
}: {
  children: React.ReactNode;
  className?: string;
  insetBottom?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={`flex-row gap-3 border-t border-border-default bg-bg-card px-4 pt-3.5 ${className}`}
      style={{ paddingBottom: insetBottom ? Math.max(insets.bottom, 16) : 14 }}
    >
      {children}
    </View>
  );
}

/** Rounded-top sticky payment/checkout bar matching Medipay PayBar. */
export function PayBar({
  label,
  amount,
  caption,
  children,
  className = '',
  insetBottom = true,
}: {
  label?: string;
  amount?: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
  insetBottom?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={`gap-3 rounded-t-2xl border-t border-border-default bg-bg-card px-4 pt-3.5 shadow-lg ${className}`}
      style={{ paddingBottom: insetBottom ? Math.max(insets.bottom, 20) : 14 }}
    >
      {amount ? (
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1">
            {label ? <Text className="text-caption text-text-secondary">{label}</Text> : null}
            {caption ? <Text className="text-caption text-text-placeholder">{caption}</Text> : null}
          </View>
          <Text className="text-title font-bold text-text-brand" numberOfLines={1}>
            {amount}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Rounded pill search field matching Medipay SearchPill. */
export function SearchPill({
  placeholder,
  value,
  onChangeText,
  onSubmitEditing,
  subtle = true,
  testID,
}: {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  subtle?: boolean;
  testID?: string;
}) {
  return (
    <View
      className={`h-[42px] flex-1 flex-row items-center gap-2 rounded-3xl px-3.5 ${
        subtle ? 'bg-bg-subtle' : 'border border-border-default bg-bg-card'
      }`}
    >
      <Icon color={colors.semantic.textSecondary} name="search" size={18} />
      <TextInput
        className="flex-1 p-0 font-inter text-body text-text-primary"
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.semantic.textPlaceholder}
        returnKeyType="search"
        style={{ includeFontPadding: false }}
        testID={testID}
        value={value}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityLabel="Xóa tìm kiếm"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onChangeText('')}
        >
          <Icon color={colors.semantic.textPlaceholder} name="close" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Dashed divider matching Medipay booking cards and receipts. */
export function Dashed({ className = '' }: { className?: string }) {
  return <View className={`border-t border-dashed border-border-divider ${className}`} />;
}

/** Icon-box + label/value summary item matching Medipay ReviewItem. */
export function ReviewItem({
  icon = 'inventory-2',
  title,
  subtitle,
  right,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="size-11 items-center justify-center rounded-lg bg-primary-50">
        <Icon color={colors.semantic.textBrand} name={icon} size={20} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-body-lg font-semibold text-text-primary" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-caption text-text-secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
