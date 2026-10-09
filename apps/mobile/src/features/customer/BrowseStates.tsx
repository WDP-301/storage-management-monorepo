import { Button, Card } from 'heroui-native';
import { ActivityIndicator, Text, View } from 'react-native';

/** Placeholders shown instead of the facility list while loading, on failure, or with no results. */

export function LoadingState() {
  return (
    <View className="items-center gap-3 px-4 py-16">
      <ActivityIndicator />
      <Text className="font-body text-body-sm text-muted">Đang tải danh sách kho trống...</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="mx-4 mt-6 border border-danger/25 bg-danger/10">
      <Card.Body className="gap-3">
        <Text className="font-strong text-foreground">Không tải được danh sách kho</Text>
        <Text className="font-body text-body-sm leading-5 text-danger">{message}</Text>
        <Button variant="secondary" onPress={onRetry}>
          <Button.Label className="font-ui">Thử lại</Button.Label>
        </Button>
      </Card.Body>
    </Card>
  );
}

/** `isFilteredOut` distinguishes "filters matched nothing" from "the API returned nothing". */
export function EmptyState({ isFilteredOut }: { isFilteredOut: boolean }) {
  return (
    <View className="mx-4 items-center rounded-2xl border border-dashed border-border px-5 py-10">
      <Text className="font-strong text-foreground">
        {isFilteredOut ? 'Không có kho nào khớp bộ lọc' : 'Chưa có kho trống'}
      </Text>
      <Text className="font-body mt-1 text-center text-body-sm leading-5 text-muted">
        {isFilteredOut
          ? 'Thử mở rộng khu vực, kích thước hoặc ngân sách.'
          : 'Hiện chưa có kho nào đang trống. Vui lòng quay lại sau.'}
      </Text>
    </View>
  );
}
