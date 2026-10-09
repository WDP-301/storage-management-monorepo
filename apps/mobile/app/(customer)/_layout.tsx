import { Tabs as RouterTabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button, useThemeColor } from 'heroui-native';
import { Buildings, Receipt, UserCircle } from 'phosphor-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { HoldProvider, useHold } from '../../lib/hold';
import { BottomTabButton } from '../../src/components/BottomTabButton';
import { StorageIcon } from '../../src/components/TabIcons';
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
  const backgroundColor = useThemeColor('background');

  return (
    <HoldProvider>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <RouterTabs
          backBehavior="history"
          screenOptions={{ headerShown: false, sceneStyle: { backgroundColor } }}
          tabBar={({ state }) => (
            <CustomerTabBar
              activeTab={toCustomerTab(state.routes[state.index]?.name)}
              onSelect={(tab) => router.navigate(TAB_HREFS[tab])}
            />
          )}
        >
          <RouterTabs.Screen name="browse" options={{ title: 'Tìm kho' }} />
          <RouterTabs.Screen name="bookings" options={{ title: 'Đặt chỗ của tôi' }} />
          <RouterTabs.Screen name="storage" options={{ title: 'Kho của tôi' }} />
          <RouterTabs.Screen name="contract-detail" options={{ title: 'Chi tiết hợp đồng' }} />
          <RouterTabs.Screen name="settings" options={{ title: 'Tài khoản' }} />
          {/* Scheduling is reached after selecting units; it has no tab button. */}
          <RouterTabs.Screen name="schedule" options={{ title: 'Đặt lịch thuê' }} />
          {/* Deposit payment is reached from a booking, so it has no tab button either. */}
          <RouterTabs.Screen name="payment" options={{ title: 'Thanh toán tiền cọc' }} />
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
  const { activeHolds, heldBooking, heldUnitCount, remaining, isExpiringSoon } = useHold();
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
            {/* Countdown leads: it is the only part of this bar that is running out. */}
            <View className="flex-1">
              <View className="flex-row items-baseline gap-2">
                <Text
                  className={`font-numeric text-lg ${
                    isExpiringSoon ? 'text-danger' : 'text-accent'
                  }`}
                >
                  {remaining}
                </Text>
                <Text className="font-ui text-foreground text-xs">
                  {isExpiringSoon
                    ? `Sắp hết giữ ${heldUnitCount} kho`
                    : `Đang giữ ${heldUnitCount} kho`}
                </Text>
              </View>
              <Text className="font-body mt-0.5 text-[11px] text-muted" numberOfLines={1}>
                {hasManyHolds
                  ? `${activeHolds.length} booking, sắp hết hạn: ${heldBooking.bookingNo}`
                  : heldBooking.bookingNo}
              </Text>
            </View>
            <Button size="sm" onPress={() => onSelect('bookings')}>
              <Button.Label className="font-ui">Xem đặt chỗ</Button.Label>
            </Button>
          </View>
        </View>
      ) : null}

      <View className="flex-row border-t border-border bg-surface px-3 pb-1 pt-1.5">
        <BottomTabButton
          icon={<Buildings color={iconColor('browse')} size={24} />}
          isSelected={activeTab === 'browse'}
          label="Tìm kho"
          onPress={() => onSelect('browse')}
        />
        <BottomTabButton
          badge={heldUnitCount > 0 ? heldUnitCount : undefined}
          icon={<Receipt color={iconColor('bookings')} size={24} />}
          isSelected={activeTab === 'bookings'}
          label="Đặt chỗ của tôi"
          onPress={() => onSelect('bookings')}
        />
        <BottomTabButton
          icon={<StorageIcon color={iconColor('storage')} />}
          isSelected={activeTab === 'storage'}
          label="Kho của tôi"
          onPress={() => onSelect('storage')}
        />
        <BottomTabButton
          icon={<UserCircle color={iconColor('settings')} size={24} />}
          isSelected={activeTab === 'settings'}
          label="Tài khoản"
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
