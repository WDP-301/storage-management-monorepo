import { Tabs as RouterTabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Bell } from 'phosphor-react-native';
import { Alert } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import {
  NotificationsUnreadProvider,
  useUnreadNotifications,
} from '../../lib/notifications-unread';
import { CalendarIcon, RequestIcon, ScanIcon, SettingsIcon } from '../../src/components/TabIcons';
import { Navbar, type NavbarTab } from '../../src/components/ui';
import { shouldConfirmLeave } from '../../src/features/staff/leave-guard';
import type { StaffTab } from '../../src/types/staff';

const SafeAreaView = withUniwind(RNSafeAreaView);

const TAB_HREFS = {
  today: '/(staff)/today',
  scan: '/(staff)/scan',
  requests: '/(staff)/requests',
  notifications: '/(staff)/notifications',
  settings: '/(staff)/settings',
} as const;

/** Area for FACILITY_STAFF / FACILITY_MANAGER working on site. */
export default function StaffTabsLayout() {
  const router = useRouter();

  return (
    <NotificationsUnreadProvider>
      <SafeAreaView className="flex-1 bg-bg-page" edges={['top']}>
        <StatusBar style="dark" />
        <RouterTabs
          screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#FDFDFF' } }}
          tabBar={({ state }) => (
            <StaffTabBar
              activeTab={toStaffTab(state.routes[state.index]?.name)}
              onSelect={(tab) => {
                const go = () => router.navigate(TAB_HREFS[tab]);
                if (!shouldConfirmLeave()) return go();
                Alert.alert(
                  'Bỏ thay đổi?',
                  'Màn hình đang có thay đổi chưa lưu hoặc ảnh đang tải lên.',
                  [
                    { text: 'Ở lại', style: 'cancel' },
                    { text: 'Bỏ thay đổi', style: 'destructive', onPress: go },
                  ],
                );
              }}
            />
          )}
        >
          <RouterTabs.Screen name="today" options={{ title: 'Hôm nay' }} />
          <RouterTabs.Screen name="scan" options={{ title: 'Gửi / lấy đồ' }} />
          <RouterTabs.Screen name="requests" options={{ title: 'Yêu cầu' }} />
          <RouterTabs.Screen name="notifications" options={{ title: 'Thông báo' }} />
          <RouterTabs.Screen name="settings" options={{ title: 'Tài khoản' }} />
          <RouterTabs.Screen name="staff-contract" options={{ title: 'Hợp đồng' }} />
          <RouterTabs.Screen name="staff-ticket" options={{ title: 'Chi tiết yêu cầu' }} />
          <RouterTabs.Screen name="shelf-receipt-form" options={{ title: 'Phiếu gửi / lấy đồ' }} />
          <RouterTabs.Screen name="shelf-receipt" options={{ title: 'Chi tiết phiếu' }} />
          <RouterTabs.Screen name="staff-tour" options={{ title: 'Ca dẫn khách' }} />
          <RouterTabs.Screen name="staff-maintenance" options={{ title: 'Bảo trì' }} />
          <RouterTabs.Screen name="shifts" options={{ title: 'Ca làm việc' }} />
          <RouterTabs.Screen name="profile-edit" options={{ title: 'Chỉnh sửa hồ sơ' }} />
          <RouterTabs.Screen name="change-password" options={{ title: 'Đổi mật khẩu' }} />
        </RouterTabs>
      </SafeAreaView>
    </NotificationsUnreadProvider>
  );
}

function StaffTabBar({
  activeTab,
  onSelect,
}: {
  activeTab: StaffTab;
  onSelect: (tab: StaffTab) => void;
}) {
  const { unread } = useUnreadNotifications();

  const tabs: NavbarTab[] = [
    {
      key: 'today',
      label: 'Hôm nay',
      renderIcon: (color) => <CalendarIcon color={color} />,
    },
    {
      key: 'scan',
      label: 'Gửi / lấy đồ',
      renderIcon: (color) => <ScanIcon color={color} />,
    },
    {
      key: 'requests',
      label: 'Yêu cầu',
      renderIcon: (color) => <RequestIcon color={color} />,
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
      renderIcon: (color) => <SettingsIcon color={color} />,
    },
  ];

  return (
    <Navbar activeKey={activeTab} onTabPress={(key) => onSelect(key as StaffTab)} tabs={tabs} />
  );
}

function toStaffTab(routeName: string | undefined): StaffTab {
  if (
    routeName === 'staff-contract' ||
    routeName === 'staff-tour' ||
    routeName === 'staff-maintenance' ||
    routeName === 'shifts'
  ) {
    return 'today';
  }
  if (routeName === 'staff-ticket') return 'requests';
  if (routeName === 'shelf-receipt-form' || routeName === 'shelf-receipt') return 'scan';
  if (
    routeName === 'scan' ||
    routeName === 'requests' ||
    routeName === 'notifications' ||
    routeName === 'settings'
  ) {
    return routeName;
  }
  if (routeName === 'profile-edit' || routeName === 'change-password') return 'settings';
  return 'today';
}
