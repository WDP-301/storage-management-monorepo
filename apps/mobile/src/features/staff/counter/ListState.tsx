import { ActivityIndicator, View } from 'react-native';
import { Button, colors, InlineMessage, Text } from '../../../components/ui';

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
      <View className="gap-3 rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
        <InlineMessage message={error} type="error" />
        <Button label="Thử lại" onPress={onRetry} size="sm" variant="secondary" />
      </View>
    );
  }
  if (loading && empty) {
    return <ActivityIndicator className="py-4" color={colors.semantic.actionPrimary} />;
  }
  if (empty) {
    return (
      <View className="rounded-[20px] border border-border-default bg-bg-card p-4">
        <Text className="text-center text-body text-text-secondary">{emptyText}</Text>
      </View>
    );
  }
  return null;
}
