import { ActivityIndicator, View } from 'react-native';
import { Button, colors, InlineMessage, Text } from '../../components/ui';

export function LoadingState() {
  return (
    <View className="items-center gap-3 px-4 py-16">
      <ActivityIndicator color={colors.semantic.actionPrimary} />
      <Text className="text-body text-text-secondary">Đang tải danh sách kho trống...</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="mx-4 mt-4 gap-3 rounded-2xl bg-bg-card p-4">
      <Text className="text-lead font-semibold text-text-primary">
        Không tải được danh sách kho
      </Text>
      <InlineMessage message={message} type="error" />
      <Button fullWidth={false} label="Thử lại" onPress={onRetry} size="sm" variant="secondary" />
    </View>
  );
}

/** `isFilteredOut` distinguishes "filters matched nothing" from "the API returned nothing". */
export function EmptyState({ isFilteredOut }: { isFilteredOut: boolean }) {
  return (
    <View className="mx-4 items-center gap-1.5 rounded-2xl bg-bg-card px-5 py-10">
      <Text className="text-lead font-semibold text-text-primary">
        {isFilteredOut ? 'Không có kho nào khớp bộ lọc' : 'Chưa có kho trống'}
      </Text>
      <Text className="text-center text-body leading-5 text-text-secondary">
        {isFilteredOut
          ? 'Thử mở rộng khu vực, kích thước hoặc ngân sách.'
          : 'Hiện chưa có kho nào đang trống. Vui lòng quay lại sau.'}
      </Text>
    </View>
  );
}
