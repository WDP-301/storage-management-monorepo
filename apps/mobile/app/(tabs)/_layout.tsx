import { Redirect, Tabs as RouterTabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button, useThemeColor } from 'heroui-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { withUniwind } from 'uniwind';
import { useHold } from '../../lib/hold';
import { useSession } from '../../lib/session';
import { SessionLoadingScreen } from '../../src/features/auth/SessionLoadingScreen';
import type { CustomerTab } from '../../src/types/customer';

const SafeAreaView = withUniwind(RNSafeAreaView);

const TAB_HREFS = {
  browse: '/(tabs)/browse',
  bookings: '/(tabs)/bookings',
  settings: '/(tabs)/settings',
} as const;

export default function CustomerTabsLayout() {
  const router = useRouter();
  const { user, isCheckingSession } = useSession();

  if (isCheckingSession) {
    return <SessionLoadingScreen />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
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
      </RouterTabs>
    </SafeAreaView>
  );
}

function CustomerTabBar({
  activeTab,
  onSelect,
}: {
  activeTab: CustomerTab;
  onSelect: (tab: CustomerTab) => void;
}) {
  const { heldBooking, remaining, clearHold } = useHold();
  const [accentColor, mutedColor] = useThemeColor(['accent', 'muted']);

  return (
    <View>
      {heldBooking ? (
        <View className="border-t border-border bg-surface px-4 py-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xs text-muted">
                Đang giữ {heldBooking.units.length} kho · {heldBooking.id}
              </Text>
              <Text className="mt-1 font-mono text-lg font-bold text-accent">{remaining}</Text>
            </View>
            <Button size="sm" variant="tertiary" onPress={clearHold}>
              <Button.Label>Hủy giữ</Button.Label>
            </Button>
            <Button size="sm" onPress={() => onSelect('bookings')}>
              <Button.Label>Xem booking</Button.Label>
            </Button>
          </View>
        </View>
      ) : null}

      <View className="flex-row border-t border-border bg-surface px-3 pb-1 pt-1.5">
        <TabButton
          accessibilityLabel="Browse units"
          icon={<UnitsIcon color={activeTab === 'browse' ? accentColor : mutedColor} />}
          isSelected={activeTab === 'browse'}
          label="Browse units"
          onPress={() => onSelect('browse')}
        />
        <TabButton
          accessibilityLabel="Booking của tôi"
          badge={heldBooking?.units.length}
          icon={<BookingIcon color={activeTab === 'bookings' ? accentColor : mutedColor} />}
          isSelected={activeTab === 'bookings'}
          label="Booking của tôi"
          onPress={() => onSelect('bookings')}
        />
        <TabButton
          accessibilityLabel="Cài đặt"
          icon={<SettingsIcon color={activeTab === 'settings' ? accentColor : mutedColor} />}
          isSelected={activeTab === 'settings'}
          label="Cài đặt"
          onPress={() => onSelect('settings')}
        />
      </View>
    </View>
  );
}

function TabButton({
  accessibilityLabel,
  badge,
  icon,
  isSelected,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  badge?: number;
  icon: ReactNode;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      className="min-h-14 flex-1 items-center justify-center gap-1"
      onPress={onPress}
    >
      <View>
        {icon}
        {badge ? (
          <View className="absolute -right-3 -top-2 min-w-5 items-center rounded-full bg-accent px-1">
            <Text className="text-[10px] font-bold text-accent-foreground">{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text className={isSelected ? 'text-xs font-bold text-accent' : 'text-xs text-muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

function UnitsIcon({ color }: { color: string }) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22} fill="none">
      <Path
        d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      <Path
        d="m4 7.5 8 4.5 8-4.5M12 12v9"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function BookingIcon({ color }: { color: string }) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22} fill="none">
      <Rect height={16} rx={2.5} stroke={color} strokeWidth={1.8} width={18} x={3} y={5} />
      <Path
        d="M8 3v4m8-4v4M3 10h18m-13 4h3m2 0h3m-8 3h3"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22} fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.96 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.62.67 1.06 1.3 1.08H21v4h-.3c-.63 0-1.17.42-1.3 1.04Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function toCustomerTab(routeName: string | undefined): CustomerTab {
  if (routeName === 'bookings' || routeName === 'settings') return routeName;
  return 'browse';
}
