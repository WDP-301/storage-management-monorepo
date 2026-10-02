import { Tabs as RouterTabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button, useThemeColor } from 'heroui-native';
import { Text, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { HoldProvider, useHold } from '../../lib/hold';
import { BottomTabButton } from '../../src/components/BottomTabButton';
import { CalendarIcon, SettingsIcon, UnitsIcon } from '../../src/components/TabIcons';
import type { CustomerTab } from '../../src/types/customer';

const SafeAreaView = withUniwind(RNSafeAreaView);

const TAB_HREFS = {
  browse: '/(customer)/browse',
  bookings: '/(customer)/bookings',
  settings: '/(customer)/settings',
} as const;

export default function CustomerTabsLayout() {
  const router = useRouter();

  return (
    <HoldProvider>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <RouterTabs
          screenOptions={{ headerShown: false }}
          tabBar={({ state }) => (
            <CustomerTabBar
              activeTab={toCustomerTab(state.routes[state.index]?.name)}
              onSelect={(tab) => router.navigate(TAB_HREFS[tab])}
            />
          )}
        >
          <RouterTabs.Screen name="browse" options={{ title: 'Browse units' }} />
          <RouterTabs.Screen name="bookings" options={{ title: 'Booking của tôi' }} />
          <RouterTabs.Screen name="settings" options={{ title: 'Cài đặt' }} />
          {/* Scheduling is reached after selecting units; the custom tab bar has three buttons. */}
          <RouterTabs.Screen name="schedule" options={{ title: 'Đặt lịch thuê' }} />
        </RouterTabs>
      </SafeAreaView>
    </HoldProvider>
  );
}

function CustomerTabBar({
  activeTab,
  onSelect,
}: {
  activeTab: CustomerTab;
  onSelect: (tab: CustomerTab) => void;
}) {
  const { heldBooking, remaining } = useHold();
  const [accentColor, mutedColor] = useThemeColor(['accent', 'muted']);
  const iconColor = (tab: CustomerTab) => (activeTab === tab ? accentColor : mutedColor);

  return (
    <View>
      {heldBooking ? (
        <View className="border-t border-border bg-surface px-4 py-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xs text-muted">
                Đang giữ {heldBooking.items.length} kho · {heldBooking.bookingNo}
              </Text>
              <Text className="mt-1 font-mono text-lg font-bold text-accent">{remaining}</Text>
            </View>
            <Button size="sm" onPress={() => onSelect('bookings')}>
              <Button.Label>Xem booking</Button.Label>
            </Button>
          </View>
        </View>
      ) : null}

      <View className="flex-row border-t border-border bg-surface px-3 pb-1 pt-1.5">
        <BottomTabButton
          icon={<UnitsIcon color={iconColor('browse')} />}
          isSelected={activeTab === 'browse'}
          label="Browse units"
          onPress={() => onSelect('browse')}
        />
        <BottomTabButton
          badge={heldBooking?.items.length}
          icon={<CalendarIcon color={iconColor('bookings')} />}
          isSelected={activeTab === 'bookings'}
          label="Booking của tôi"
          onPress={() => onSelect('bookings')}
        />
        <BottomTabButton
          icon={<SettingsIcon color={iconColor('settings')} />}
          isSelected={activeTab === 'settings'}
          label="Cài đặt"
          onPress={() => onSelect('settings')}
        />
      </View>
    </View>
  );
}

function toCustomerTab(routeName: string | undefined): CustomerTab {
  if (routeName === 'bookings' || routeName === 'settings') return routeName;
  if (routeName === 'schedule') return 'browse';
  return 'browse';
}
