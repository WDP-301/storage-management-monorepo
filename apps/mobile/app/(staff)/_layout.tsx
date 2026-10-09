import { Tabs as RouterTabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeColor } from 'heroui-native';
import { Alert, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { BottomTabButton } from '../../src/components/BottomTabButton';
import { CalendarIcon, RequestIcon, ScanIcon, SettingsIcon } from '../../src/components/TabIcons';
import { shouldConfirmLeave } from '../../src/features/staff/leave-guard';
import type { StaffTab } from '../../src/types/staff';

const SafeAreaView = withUniwind(RNSafeAreaView);

const TAB_HREFS = {
  today: '/(staff)/today',
  scan: '/(staff)/scan',
  requests: '/(staff)/requests',
  settings: '/(staff)/settings',
} as const;

/** Area for FACILITY_STAFF / FACILITY_MANAGER working on site. */
export default function StaffTabsLayout() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <RouterTabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state }) => (
          <StaffTabBar
            activeTab={toStaffTab(state.routes[state.index]?.name)}
            onSelect={(tab) => {
              const go = () => router.navigate(TAB_HREFS[tab]);
              if (!shouldConfirmLeave()) return go();
              Alert.alert('Bỏ thay đổi?', 'Biên bản có thay đổi chưa lưu hoặc ảnh đang tải lên.', [
                { text: 'Ở lại', style: 'cancel' },
                { text: 'Bỏ thay đổi', style: 'destructive', onPress: go },
              ]);
            }}
          />
        )}
      >
        <RouterTabs.Screen name="today" options={{ title: 'Hôm nay' }} />
        <RouterTabs.Screen name="scan" options={{ title: 'Quét mã' }} />
        <RouterTabs.Screen name="requests" options={{ title: 'Yêu cầu' }} />
        <RouterTabs.Screen name="settings" options={{ title: 'Cài đặt' }} />
        <RouterTabs.Screen name="inspection-detail" options={{ title: 'Biên bản' }} />
      </RouterTabs>
    </SafeAreaView>
  );
}

function StaffTabBar({
  activeTab,
  onSelect,
}: {
  activeTab: StaffTab;
  onSelect: (tab: StaffTab) => void;
}) {
  const [accentColor, mutedColor] = useThemeColor(['accent', 'muted']);
  const iconColor = (tab: StaffTab) => (activeTab === tab ? accentColor : mutedColor);

  return (
    <View className="flex-row border-t border-border bg-surface px-3 pb-1 pt-1.5">
      <BottomTabButton
        icon={<CalendarIcon color={iconColor('today')} />}
        isSelected={activeTab === 'today'}
        label="Hôm nay"
        onPress={() => onSelect('today')}
      />
      <BottomTabButton
        icon={<ScanIcon color={iconColor('scan')} />}
        isSelected={activeTab === 'scan'}
        label="Quét mã"
        onPress={() => onSelect('scan')}
      />
      <BottomTabButton
        icon={<RequestIcon color={iconColor('requests')} />}
        isSelected={activeTab === 'requests'}
        label="Yêu cầu"
        onPress={() => onSelect('requests')}
      />
      <BottomTabButton
        icon={<SettingsIcon color={iconColor('settings')} />}
        isSelected={activeTab === 'settings'}
        label="Cài đặt"
        onPress={() => onSelect('settings')}
      />
    </View>
  );
}

function toStaffTab(routeName: string | undefined): StaffTab {
  if (routeName === 'inspection-detail') return 'today';
  if (routeName === 'scan' || routeName === 'requests' || routeName === 'settings') {
    return routeName;
  }
  return 'today';
}
