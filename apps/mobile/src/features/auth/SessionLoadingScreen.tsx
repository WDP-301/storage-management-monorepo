import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

const SafeAreaView = withUniwind(RNSafeAreaView);

export function SessionLoadingScreen() {
  return (
    <SafeAreaView
      className="flex-1 items-center justify-center bg-background"
      edges={['top', 'bottom']}
    >
      <StatusBar style="dark" />
      <View className="size-12 items-center justify-center rounded-2xl bg-accent">
        <Text className="text-lg font-black text-accent-foreground">S</Text>
      </View>
      <Text className="mt-4 text-sm font-semibold text-muted">
        Đang kiểm tra phiên đăng nhập...
      </Text>
    </SafeAreaView>
  );
}
