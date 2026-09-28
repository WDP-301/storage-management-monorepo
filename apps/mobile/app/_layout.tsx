import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { SessionLoadingScreen } from '../src/features/auth/SessionLoadingScreen';
import '../global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <HeroUINativeProvider>
          <SessionProvider>
            <RootNavigator />
          </SessionProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Each route group is only reachable for the matching area, so deep links into another
 * role's area redirect automatically. This hides UI only — the API enforces permissions.
 */
function RootNavigator() {
  const { area, isCheckingSession } = useSession();

  if (isCheckingSession) {
    return <SessionLoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!area}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={area === 'customer'}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
      <Stack.Protected guard={area === 'staff'}>
        <Stack.Screen name="(staff)" />
      </Stack.Protected>
      <Stack.Protected guard={area === 'unsupported'}>
        <Stack.Screen name="unsupported" />
      </Stack.Protected>
    </Stack>
  );
}
