import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './button';
import colors from './colors';
import { Icon, type IconName } from './icon';
import { renderCoatBackdrop } from './sheet-backdrop';
import { SheetHandle } from './sheet-handle';
import { Text } from './text';

export type AlertSheetVariant = 'primary' | 'danger' | 'info' | 'warning';

export type AlertSheetAction = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
};

type Props = {
  ref?: React.RefObject<BottomSheetModal | null>;
  icon?: IconName;
  variant?: AlertSheetVariant;
  destructive?: boolean;
  title: React.ReactNode;
  message?: React.ReactNode;
  align?: 'center' | 'left';
  actionsLayout?: 'stack' | 'row';
  primaryAction?: AlertSheetAction;
  secondaryAction?: AlertSheetAction;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onDismiss?: () => void;
  testID?: string;
};

const VARIANT_ICON: Record<
  AlertSheetVariant,
  { defaultIcon: IconName; circleBg: string; iconColor: string }
> = {
  primary: {
    defaultIcon: 'info',
    circleBg: 'bg-secondary-0',
    iconColor: colors.semantic.actionPrimary,
  },
  info: {
    defaultIcon: 'info-outline',
    circleBg: 'bg-info-0',
    iconColor: colors.semantic.statusInfo,
  },
  warning: {
    defaultIcon: 'warning-amber',
    circleBg: 'bg-warning-0',
    iconColor: colors.warning[700],
  },
  danger: {
    defaultIcon: 'warning-amber',
    circleBg: 'bg-danger-0',
    iconColor: colors.semantic.statusDanger,
  },
};

/** Bottom-sheet confirmation/alert dialog matching Medipay AlertSheet. */
export function AlertSheet({
  ref,
  icon,
  variant,
  destructive = false,
  title,
  message,
  align = 'center',
  actionsLayout = 'stack',
  primaryAction,
  secondaryAction,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onDismiss,
  testID,
}: Props) {
  const insets = useSafeAreaInsets();
  const isDanger = destructive || variant === 'danger';
  const effectiveVariant: AlertSheetVariant = isDanger ? 'danger' : (variant ?? 'primary');
  const iconConfig = VARIANT_ICON[effectiveVariant];
  const resolvedIcon = icon ?? iconConfig.defaultIcon;

  const pLabel = primaryAction?.label ?? primaryLabel ?? 'Xác nhận';
  const pPress = primaryAction?.onPress ?? onPrimary ?? (() => ref?.current?.dismiss());
  const pLoading = primaryAction?.loading ?? false;

  const sLabel = secondaryAction?.label ?? secondaryLabel;
  const sPress =
    secondaryAction?.onPress ??
    onSecondary ??
    (() => {
      ref?.current?.dismiss();
    });

  const centered = align === 'center';
  const row = actionsLayout === 'row';

  const primaryButton = (
    <Button
      className={row ? 'flex-1' : undefined}
      fullWidth={!row}
      label={pLabel}
      loading={pLoading}
      onPress={() => {
        if (!pLoading) {
          ref?.current?.dismiss();
          pPress();
        }
      }}
      testID={testID ? `${testID}-primary` : undefined}
      variant={isDanger ? 'destructive' : 'primary'}
    />
  );

  const secondaryButton = sLabel ? (
    <Button
      className={row ? 'flex-1' : 'rounded-lg'}
      fullWidth={!row}
      label={sLabel}
      onPress={sPress}
      testID={testID ? `${testID}-secondary` : undefined}
      variant={row ? 'secondary' : 'text'}
    />
  ) : null;

  return (
    <BottomSheetModal
      ref={ref}
      backdropComponent={renderCoatBackdrop}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
      enableDynamicSizing
      handleComponent={SheetHandle}
      onDismiss={onDismiss}
    >
      <BottomSheetView testID={testID}>
        <View
          className="items-center gap-5 px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <View
            className={`size-16 items-center justify-center rounded-full ${iconConfig.circleBg}`}
          >
            <Icon color={iconConfig.iconColor} name={resolvedIcon} size={32} />
          </View>
          <View className="w-full gap-2">
            <Text
              className={`text-title font-semibold text-text-primary ${centered ? 'text-center' : ''}`}
            >
              {title}
            </Text>
            {message ? (
              <Text className={`text-body-lg text-text-secondary ${centered ? 'text-center' : ''}`}>
                {message}
              </Text>
            ) : null}
          </View>
          <View className={`w-full gap-3 ${row ? 'flex-row' : ''}`}>
            {row ? secondaryButton : primaryButton}
            {row ? primaryButton : secondaryButton}
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
