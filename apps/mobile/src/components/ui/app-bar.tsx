import { router } from 'expo-router';
import type * as React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from './icon';
import { Text } from './text';
import { twMerge } from './tw-merge';

type Props = {
  title?: string;
  titleAlign?: 'center' | 'left';
  showBack?: boolean;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: React.ReactNode;
  actionIcon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  testID?: string;
};

/** Top navigation bar aligned with Medipay AppBar (`h-14`, `size-11` back button). */
export function AppBar({
  title,
  titleAlign = 'center',
  showBack = true,
  onBack,
  backLabel = 'Quay lại',
  rightSlot,
  actionIcon,
  actionLabel,
  onAction,
  className = '',
  testID,
}: Props) {
  const isCenter = titleAlign === 'center';
  const handleBack =
    onBack ??
    (() => {
      if (router.canGoBack()) {
        router.back();
      }
    });

  return (
    <View
      className={twMerge(
        'h-14 flex-row items-center gap-2 border-b border-border-default bg-bg-page px-4',
        className,
      )}
      testID={testID}
    >
      {showBack ? (
        <Pressable
          accessibilityLabel={backLabel}
          accessibilityRole="button"
          className="size-11 items-center justify-center rounded-full active:bg-bg-subtle"
          onPress={handleBack}
          testID={testID ? `${testID}-back` : undefined}
        >
          <Icon name="arrow-back-ios-new" size={20} />
        </Pressable>
      ) : isCenter ? (
        <View className="size-11" />
      ) : null}

      <Text
        className={`flex-1 font-inter text-subtitle font-semibold text-text-primary ${isCenter ? 'text-center' : ''}`}
        numberOfLines={1}
      >
        {title}
      </Text>

      {rightSlot ? (
        <View className="min-w-11 items-end justify-center">{rightSlot}</View>
      ) : actionIcon ? (
        <Pressable
          accessibilityLabel={actionLabel ?? 'Tác vụ'}
          accessibilityRole="button"
          className="size-11 items-center justify-center rounded-full active:bg-bg-subtle"
          onPress={onAction}
          testID={testID ? `${testID}-action` : undefined}
        >
          <Icon name={actionIcon} />
        </Pressable>
      ) : isCenter ? (
        <View className="size-11" />
      ) : null}
    </View>
  );
}
