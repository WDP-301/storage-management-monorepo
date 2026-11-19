import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { ArrowsClockwise, SignOut, Swap } from 'phosphor-react-native';
import type { ReactNode, RefObject } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, renderCoatBackdrop, Text } from '../../components/ui';

export type RequestKind = 'renew' | 'change' | 'return';

const ROWS: Record<RequestKind, { title: string; subtitle: string; icon: ReactNode }> = {
  renew: {
    title: 'Gia hạn',
    subtitle: 'Thuê tiếp với giá hiện tại, chi nhánh duyệt',
    icon: <ArrowsClockwise color={colors.semantic.actionPrimary} size={22} weight="bold" />,
  },
  change: {
    title: 'Đổi kho',
    subtitle: 'Chuyển sang kho khác cùng loại, kèm ngày chuyển đồ',
    icon: <Swap color={colors.semantic.actionPrimary} size={22} weight="bold" />,
  },
  return: {
    title: 'Trả kho',
    subtitle: 'Hẹn ngày dọn đồ và kết thúc hợp đồng',
    icon: <SignOut color={colors.semantic.actionPrimary} size={22} weight="bold" />,
  },
};

/** Sheet listing the requests a contract allows right now; picking one opens its form. */
export function ContractRequestPicker({
  sheetRef,
  kinds,
  onPick,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
  kinds: readonly RequestKind[];
  onPick: (kind: RequestKind) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderCoatBackdrop}
      backgroundStyle={{ backgroundColor: colors.semantic.bgCard }}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: colors.neutral[300] }}
      snapPoints={[kinds.length > 2 ? '48%' : '36%']}
    >
      <BottomSheetView
        className="gap-3 px-4"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <Text className="text-title-sm font-bold text-text-primary">Tạo yêu cầu</Text>
        {kinds.map((kind) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-2xl border border-border-default bg-bg-subtle px-3.5 py-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            onPress={() => onPick(kind)}
          >
            <View className="size-10 items-center justify-center rounded-full bg-secondary-0">
              {ROWS[kind].icon}
            </View>
            <View className="flex-1">
              <Text className="text-body-sm font-semibold text-text-primary">
                {ROWS[kind].title}
              </Text>
              <Text className="text-caption text-text-secondary">{ROWS[kind].subtitle}</Text>
            </View>
          </Pressable>
        ))}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
