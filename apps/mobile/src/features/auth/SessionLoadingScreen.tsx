import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { Text } from '../../components/ui';
import colors from '../../components/ui/colors';

const SafeAreaView = withUniwind(RNSafeAreaView);

export function SessionLoadingScreen() {
  return (
    <SafeAreaView
      className="flex-1 items-center justify-center bg-bg-page"
      edges={['top', 'bottom']}
    >
      <StatusBar style="dark" />
      <View className="size-14 items-center justify-center rounded-2xl bg-primary-500">
        <Text className="text-heading font-bold text-text-inverse">S</Text>
      </View>
      <ActivityIndicator className="mt-5" color={colors.semantic.actionPrimary} size="small" />
      <Text className="mt-3 text-body font-medium text-text-secondary">
        Đang kiểm tra phiên đăng nhập...
      </Text>
    </SafeAreaView>
  );
}
