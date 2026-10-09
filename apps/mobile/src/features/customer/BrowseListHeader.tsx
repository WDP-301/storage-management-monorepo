import { Pressable, Text, View } from 'react-native';
import type { BrowseMode } from '../../types/customer';

type Props = {
  mode: BrowseMode;
  onModeChange: (mode: BrowseMode) => void;
  facilityCount: number;
  /** `true` when the page cap truncated the fetch, so the list is knowingly partial. */
  hasMore: boolean;
  requestedQuantity: number;
};

/** Selection-mode switch plus the result summary sitting above the facility list. */
export function BrowseListHeader({
  mode,
  onModeChange,
  facilityCount,
  hasMore,
  requestedQuantity,
}: Props) {
  return (
    <>
      {/* Result summary and mode switch share one block rather than stacking two.
          They answer the same question — what am I looking at, and how do I pick from it — and as
          separate sections they pushed the first facility card past 40% of the screen.
          The summary also says WHY these facilities are the ones shown, which is otherwise
          invisible: in recommended mode the list is already restricted to places that can cover
          the whole request from one building. */}
      <View className="mx-4 mt-3 mb-3 gap-3">
        <View className="flex-row items-start gap-2 rounded-xl bg-success-bg px-3 py-3">
          <SealCheck size={19} color="#059669" />
          <View className="flex-1">
            <Text className="font-ui text-body-sm text-success">
              {mode === 'recommended'
                ? `Hệ thống ưu tiên nhóm ${requestedQuantity} kho trống tại cùng một cơ sở.`
                : `Tự chọn từng kho phù hợp tại ${facilityCount} cơ sở đang còn kho trống.`}
            </Text>
            <Text className="font-body mt-0.5 text-caption text-muted">
              {mode === 'recommended'
                ? 'Giúp bạn tập trung hàng hóa, tiện vận chuyển và quản lý kho.'
                : 'Chọn từng kho theo ý bạn, rẻ nhất xếp trước.'}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-2">
          <ModeOption
            isSelected={mode === 'recommended'}
            label="Hệ thống đề xuất"
            onPress={() => onModeChange('recommended')}
          />
          <ModeOption
            isSelected={mode === 'manual'}
            label="Tự chọn kho"
            onPress={() => onModeChange('manual')}
          />
        </View>
      </View>

      {hasMore ? (
        <Text className="font-body mb-3 px-4 text-xs leading-5 text-muted">
          Danh sách đang hiển thị một phần số kho trống. Thu hẹp bộ lọc để xem chính xác hơn.
        </Text>
      ) : null}
    </>
  );
}

/**
 * Mode choice rendered on the summary's tinted ground rather than as a pair of filled buttons.
 *
 * Filled buttons here competed with the "Chọn nhóm N kho" action further down the screen, which is
 * the one that actually commits the customer to something.
 */
function ModeOption({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      className="flex-1"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      <View
        className={`items-center rounded-lg border py-2 ${
          isSelected ? 'border-accent bg-surface' : 'border-transparent bg-transparent'
        }`}
      >
        <Text className={`font-ui text-body-sm ${isSelected ? 'text-accent' : 'text-muted'}`}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

import { SealCheck } from 'phosphor-react-native';
