import { Tabs as RouterTabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Bell, Buildings, UserCircle } from 'phosphor-react-native';
import { View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { BrowseSelectionProvider } from '../../lib/browse-selection';
import { HoldProvider, useHold } from '../../lib/hold';
import {
  NotificationsUnreadProvider,
  useUnreadNotifications,
} from '../../lib/notifications-unread';
import { StorageIcon } from '../../src/components/TabIcons';
import { Button, Navbar, type NavbarTab, Text } from '../../src/components/ui';
import type { CustomerTab } from '../../src/types/customer';

const SafeAreaView = withUniwind(RNSafeAreaView);

const TAB_HREFS = {
  browse: '/(customer)/browse',
  storage: '/(customer)/storage',
  notifications: '/(customer)/notifications',
  settings: '/(customer)/settings',
} as const;

export default function CustomerTabsLayout() {
  const router = useRouter();

  return (
    <HoldProvider>
      <NotificationsUnreadProvider>
        <BrowseSelectionProvider>
          <SafeAreaView className="flex-1 bg-bg-page" edges={['top']}>
            <StatusBar style="dark" />
            <RouterTabs
              backBehavior="history"
              screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: '#FDFDFF' },
              }}
              tabBar={({ state }) =>
                ['shelves', 'schedule', 'payment'].includes(
                  state.routes[state.index]?.name ?? '',
                ) ? null : (
                  <CustomerTabBar
                    activeTab={toCustomerTab(state.routes[state.index]?.name)}
                    onPaySingleHold={(id) =>
                      router.navigate(`/(customer)/payment?id=${encodeURIComponent(id)}`)
                    }
                    onSelect={(tab) => router.navigate(TAB_HREFS[tab])}
                  />
                )
              }
            >
              <RouterTabs.Screen name="browse" options={{ title: 'Tìm kho' }} />
              <RouterTabs.Screen name="shelves" options={{ title: 'Chọn kệ' }} />
              <RouterTabs.Screen name="storage" options={{ title: 'Kho của tôi' }} />
              <RouterTabs.Screen name="contract-detail" options={{ title: 'Chi tiết hợp đồng' }} />
              <RouterTabs.Screen name="notifications" options={{ title: 'Thông báo' }} />
              <RouterTabs.Screen name="settings" options={{ title: 'Tài khoản' }} />
              <RouterTabs.Screen name="schedule" options={{ title: 'Đặt lịch thuê' }} />
              <RouterTabs.Screen name="payment" options={{ title: 'Thanh toán tiền cọc' }} />
              <RouterTabs.Screen name="tickets" options={{ title: 'Yêu cầu hỗ trợ' }} />
              <RouterTabs.Screen name="ticket-detail" options={{ title: 'Chi tiết yêu cầu' }} />
              <RouterTabs.Screen name="ticket-create" options={{ title: 'Tạo yêu cầu' }} />
              <RouterTabs.Screen name="tours" options={{ title: 'Lịch hẹn xem kho' }} />
              <RouterTabs.Screen name="profile-edit" options={{ title: 'Chỉnh sửa hồ sơ' }} />
              <RouterTabs.Screen name="change-password" options={{ title: 'Đổi mật khẩu' }} />
              <RouterTabs.Screen
                name="warehouse-rules"
                options={{ title: 'Quy định sử dụng kho' }}
              />
            </RouterTabs>
          </SafeAreaView>
        </BrowseSelectionProvider>
      </NotificationsUnreadProvider>
    </HoldProvider>
  );
}

function CustomerTabBar({
  activeTab,
  onSelect,
  onPaySingleHold,
}: {
  activeTab: CustomerTab;
  onSelect: (tab: CustomerTab) => void;
  onPaySingleHold: (bookingId: string) => void;
}) {
  const { activeHolds, heldBooking, heldUnitCount, remaining, isExpiringSoon } = useHold();
  const { unread } = useUnreadNotifications();
  const hasManyHolds = activeHolds.length > 1;
  const showHoldBar = heldBooking !== null && activeTab !== 'storage';

  const tabs: NavbarTab[] = [
    {
      key: 'browse',
      label: 'Tìm kho',
      renderIcon: (color) => <Buildings color={color} size={22} />,
    },
    {
      key: 'storage',
      label: 'Kho của tôi',
      badge: heldUnitCount > 0 ? heldUnitCount : undefined,
      renderIcon: (color) => <StorageIcon color={color} />,
    },
    {
      key: 'notifications',
      label: 'Thông báo',
      badge: unread > 0 ? unread : undefined,
      renderIcon: (color) => <Bell color={color} size={22} />,
    },
    {
      key: 'settings',
      label: 'Tài khoản',
      renderIcon: (color) => <UserCircle color={color} size={22} />,
    },
  ];

  return (
    <View>
      {showHoldBar && heldBooking ? (
        <View className="border-t border-warning-500/30 bg-warning-0 px-4 py-2.5">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <View className="flex-row items-baseline gap-2">
                <Text
                  className={`font-inter text-lead font-bold ${
                    isExpiringSoon ? 'text-status-danger' : 'text-text-link'
                  }`}
                >
                  {remaining}
                </Text>
                <Text className="text-caption font-semibold text-text-primary">
                  {isExpiringSoon
                    ? `Sắp hết giữ ${heldUnitCount} kho`
                    : `Đang giữ ${heldUnitCount} kho`}
                </Text>
              </View>
              <Text className="mt-0.5 text-caption text-text-secondary" numberOfLines={1}>
                {hasManyHolds
                  ? `Bạn có ${activeHolds.length} đơn đang chờ thanh toán cọc`
                  : 'Hoàn tất đặt cọc để giữ kho đã chọn'}
              </Text>
            </View>
            <Button
              fullWidth={false}
              label="Thanh toán cọc"
              onPress={() => {
                if (activeHolds.length === 1) {
                  onPaySingleHold(heldBooking.id);
                } else {
                  onSelect('storage');
                }
              }}
              size="sm"
            />
          </View>
        </View>
      ) : null}

      <Navbar
        activeKey={activeTab}
        onTabPress={(key) => onSelect(key as CustomerTab)}
        tabs={tabs}
      />
    </View>
  );
}

function toCustomerTab(routeName: string | undefined): CustomerTab {
  if (routeName === 'storage' || routeName === 'notifications' || routeName === 'settings') {
    return routeName;
  }
  if (routeName === 'contract-detail') return 'storage';
  if (routeName === 'schedule') return 'browse';
  if (routeName === 'payment') return 'storage';
  if (
    routeName === 'tickets' ||
    routeName === 'ticket-detail' ||
    routeName === 'ticket-create' ||
    routeName === 'tours' ||
    routeName === 'profile-edit' ||
    routeName === 'change-password' ||
    routeName === 'warehouse-rules'
  ) {
    return 'settings';
  }
  return 'browse';
}
