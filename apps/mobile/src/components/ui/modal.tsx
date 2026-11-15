import {
  type BottomSheetBackdropProps,
  BottomSheetModal,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import colors from './colors';
import { Icon } from './icon';
import { renderCoatBackdrop } from './sheet-backdrop';
import { SheetHandle } from './sheet-handle';
import { Text } from './text';

export function useModal() {
  const ref = React.useRef<BottomSheetModal>(null);
  const present = React.useCallback(() => {
    ref.current?.present();
  }, []);
  const dismiss = React.useCallback(() => {
    ref.current?.dismiss();
  }, []);
  return { ref, present, dismiss };
}

type ModalProps = BottomSheetModalProps & {
  title?: string;
  detached?: boolean;
  ref?: React.Ref<BottomSheetModal>;
};

/** BottomSheetModal wrapper styled after Medipay Modal. */
export function Modal({
  ref,
  snapPoints: _snapPoints = ['60%'],
  title,
  detached = false,
  backdropComponent,
  backgroundStyle,
  ...props
}: ModalProps) {
  const internalRef = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => _snapPoints, [_snapPoints]);

  React.useImperativeHandle(ref, () => internalRef.current as BottomSheetModal, []);

  const dismiss = React.useCallback(() => {
    internalRef.current?.dismiss();
  }, []);

  const renderHandle = React.useCallback(
    () => (
      <View>
        <SheetHandle />
        {title ? (
          <View className="flex-row items-center gap-2 border-b border-border-divider px-4 py-3">
            <Text className="flex-1 text-lead font-semibold text-text-primary" numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              accessibilityLabel="Đóng"
              accessibilityRole="button"
              className="size-9 items-center justify-center rounded-full active:bg-bg-subtle"
              hitSlop={12}
              onPress={dismiss}
            >
              <Icon color={colors.semantic.textSecondary} name="close" size={20} />
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [dismiss, title],
  );

  const renderBackdrop = React.useCallback(
    (backdropProps: BottomSheetBackdropProps) =>
      backdropComponent ? backdropComponent(backdropProps) : renderCoatBackdrop(backdropProps),
    [backdropComponent],
  );

  const detachedProps: Partial<BottomSheetModalProps> = detached
    ? {
        detached: true,
        bottomInset: 46,
        style: { marginHorizontal: 16, overflow: 'hidden' },
      }
    : {};

  return (
    <BottomSheetModal
      {...props}
      {...detachedProps}
      ref={internalRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.background, backgroundStyle]}
      enableDynamicSizing={props.enableDynamicSizing ?? false}
      handleComponent={renderHandle}
      index={props.index ?? 0}
      snapPoints={snapPoints}
    />
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.semantic.bgPage,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});
