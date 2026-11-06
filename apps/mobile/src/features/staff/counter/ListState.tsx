import { Button } from 'heroui-native';
import { ActivityIndicator, Text, View } from 'react-native';

/** Loading / error / empty placeholder shared by the counter lists; renders nothing once there is data. */
export function ListState({
  loading,
  error,
  empty,
  emptyText,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText: string;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <View className="gap-2 rounded-xl bg-danger-bg p-3">
        <Text className="font-body text-body-sm text-danger">{error}</Text>
        <Button size="sm" variant="secondary" onPress={onRetry}>
          <Button.Label>Thử lại</Button.Label>
        </Button>
      </View>
    );
  }
  if (loading && empty) return <ActivityIndicator />;
  if (empty) {
    return (
      <Text className="rounded-xl bg-surface-secondary p-3 font-body text-body-sm text-muted">
        {emptyText}
      </Text>
    );
  }
  return null;
}
