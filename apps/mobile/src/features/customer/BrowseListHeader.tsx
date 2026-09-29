import { Button, Chip } from 'heroui-native';
import { Text, View } from 'react-native';
import type { BrowseMode } from '../../types/customer';

type Props = {
  mode: BrowseMode;
  onModeChange: (mode: BrowseMode) => void;
  facilityCount: number;
  /** `true` when the page cap truncated the fetch, so the list is knowingly partial. */
  hasMore: boolean;
};

/** Selection-mode switch plus the result summary sitting above the facility list. */
export function BrowseListHeader({ mode, onModeChange, facilityCount, hasMore }: Props) {
  return (
    <>
      <View className="mt-6 px-4">
        <Text className="text-sm font-bold text-foreground">Cách chọn kho</Text>
        <View className="mt-2 flex-row gap-2">
          <Button
            className="flex-1"
            size="sm"
            variant={mode === 'recommended' ? 'primary' : 'secondary'}
            onPress={() => onModeChange('recommended')}
          >
            <Button.Label>Hệ thống đề xuất</Button.Label>
          </Button>
          <Button
            className="flex-1"
            size="sm"
            variant={mode === 'manual' ? 'primary' : 'secondary'}
            onPress={() => onModeChange('manual')}
          >
            <Button.Label>Tự chọn kho</Button.Label>
          </Button>
        </View>
      </View>

      <View className="mb-3 mt-6 flex-row items-center justify-between px-4">
        <View className="flex-1">
          <Text className="font-bold text-foreground">
            {mode === 'recommended' ? 'Nhóm kho phù hợp' : 'Kho đang còn trống'}
          </Text>
          <Text className="mt-1 text-xs text-muted">Sắp xếp theo giá thuê từ thấp đến cao</Text>
        </View>
        <Chip color="accent" size="sm" variant="soft">
          <Chip.Label>{facilityCount} cơ sở</Chip.Label>
        </Chip>
      </View>

      {hasMore ? (
        <Text className="mb-3 px-4 text-xs leading-5 text-muted">
          Danh sách đang hiển thị một phần số kho trống. Thu hẹp bộ lọc để xem chính xác hơn.
        </Text>
      ) : null}
    </>
  );
}
