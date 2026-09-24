import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { HoldProvider } from '../lib/hold';
import { SessionProvider } from '../lib/session';
import '../global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <HeroUINativeProvider>
          <SessionProvider>
            <HoldProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </HoldProvider>
          </SessionProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
