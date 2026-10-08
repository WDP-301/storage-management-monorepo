import { Tabs as RouterTabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button, useThemeColor } from 'heroui-native';
import { Text, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { HoldProvider, useHold } from '../../lib/hold';
import { BottomTabButton } from '../../src/components/BottomTabButton';
import { CalendarIcon, SettingsIcon, StorageIcon, UnitsIcon } from '../../src/components/TabIcons';
import type { CustomerTab } from '../../src/types/customer';

const SafeAreaView = withUniwind(RNSafeAreaView);

const TAB_HREFS = {
  browse: '/(customer)/browse',
  bookings: '/(customer)/bookings',
  storage: '/(customer)/storage',
  settings: '/(customer)/settings',
} as const;

export default function CustomerTabsLayout() {
  const router = useRouter();

  return (
    <HoldProvider>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <RouterTabs
          // Hidden screens (contract detail, payment, tickets) must go back to where they were
          // opened from, not to the first tab.
          backBehavior="history"
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
          <RouterTabs.Screen name="storage" options={{ title: 'Kho của tôi' }} />
          {/* Contract detail is reached from a "Kho của tôi" card; it has no tab button. */}
          <RouterTabs.Screen name="contract-detail" options={{ title: 'Chi tiết hợp đồng' }} />
          <RouterTabs.Screen name="settings" options={{ title: 'Cài đặt' }} />
          {/* Scheduling is reached after selecting units; it has no tab button. */}
          <RouterTabs.Screen name="schedule" options={{ title: 'Đặt lịch thuê' }} />
          {/* Deposit payment is reached from a booking, so it has no tab button either. */}
          <RouterTabs.Screen name="payment" options={{ title: 'Thanh toán tiền cọc' }} />
          {/* Ticket screens are reached from Settings → Hỗ trợ; they highlight the settings tab. */}
          <RouterTabs.Screen name="tickets" options={{ title: 'Yêu cầu hỗ trợ' }} />
          <RouterTabs.Screen name="ticket-detail" options={{ title: 'Chi tiết yêu cầu' }} />
          <RouterTabs.Screen name="ticket-create" options={{ title: 'Tạo yêu cầu' }} />
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
  const { activeHolds, heldBooking, heldUnitCount, remaining } = useHold();
  const [accentColor, mutedColor] = useThemeColor(['accent', 'muted']);
  const iconColor = (tab: CustomerTab) => (activeTab === tab ? accentColor : mutedColor);
  // Several bookings can hold units at once, so the bar summarises all of them and counts down the
  // one expiring first; naming a single booking number would hide the rest.
  const hasManyHolds = activeHolds.length > 1;

  return (
    <View>
      {heldBooking ? (
        <View className="border-t border-border bg-surface px-4 py-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xs text-muted">
                Đang giữ {heldUnitCount} kho ·{' '}
                {hasManyHolds ? `${activeHolds.length} booking` : heldBooking.bookingNo}
              </Text>
              <View className="mt-1 flex-row items-baseline gap-2">
                <Text className="font-mono text-lg font-bold text-accent">{remaining}</Text>
                {hasManyHolds ? (
                  <Text className="flex-1 text-[11px] text-muted" numberOfLines={1}>
                    sắp hết hạn · {heldBooking.bookingNo}
                  </Text>
                ) : null}
              </View>
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
          badge={heldUnitCount > 0 ? heldUnitCount : undefined}
          icon={<CalendarIcon color={iconColor('bookings')} />}
          isSelected={activeTab === 'bookings'}
          label="Booking của tôi"
          onPress={() => onSelect('bookings')}
        />
        <BottomTabButton
          icon={<StorageIcon color={iconColor('storage')} />}
          isSelected={activeTab === 'storage'}
          label="Kho của tôi"
          onPress={() => onSelect('storage')}
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
  if (routeName === 'bookings' || routeName === 'storage' || routeName === 'settings') {
    return routeName;
  }
  if (routeName === 'contract-detail') return 'storage';
  if (routeName === 'schedule') return 'browse';
  // Paying a deposit belongs to the booking the customer came from, not to browsing.
  if (routeName === 'payment') return 'bookings';
  if (routeName === 'tickets' || routeName === 'ticket-detail' || routeName === 'ticket-create') {
    return 'settings';
  }
  return 'browse';
}
