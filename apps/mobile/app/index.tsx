import { StatusBar } from 'expo-status-bar';
import { Button, Tabs, useThemeColor } from 'heroui-native';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { withUniwind } from 'uniwind';
import { AuthApi } from '../lib/api';
import { LoginScreen } from '../src/features/auth/LoginScreen';
import { BrowseUnitsScreen } from '../src/features/customer/BrowseUnitsScreen';
import { MyBookingsScreen } from '../src/features/customer/MyBookingsScreen';
import { SettingsScreen } from '../src/features/settings/SettingsScreen';
import type { AuthUser } from '../src/types/auth';
import type { CustomerTab, HeldBooking, UnitOffer } from '../src/types/customer';

const HOLD_DURATION_MS = 15 * 60 * 1000;
const SafeAreaView = withUniwind(RNSafeAreaView);

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

export default function HomeScreen() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomerTab>('browse');
  const [heldBooking, setHeldBooking] = useState<HeldBooking | null>(null);
  const [now, setNow] = useState(Date.now());
  const [accentColor, mutedColor] = useThemeColor(['accent', 'muted']);

  useEffect(() => {
    AuthApi.me()
      .then(setAuthUser)
      .catch(() => undefined)
      .finally(() => setIsCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!heldBooking) return;

    const timer = setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      setHeldBooking((current) => (current && current.holdExpiresAt <= nextNow ? null : current));
    }, 1000);

    return () => clearInterval(timer);
  }, [heldBooking]);

  const remaining = useMemo(
    () => formatRemaining((heldBooking?.holdExpiresAt ?? now) - now),
    [heldBooking, now],
  );

  const holdUnits = (units: UnitOffer[]) => {
    const holdExpiresAt = Date.now() + HOLD_DURATION_MS;
    setNow(Date.now());
    setHeldBooking({
      id: `BK-${String(Date.now()).slice(-6)}`,
      units,
      startDate: '28/09/2026',
      durationMonths: 3,
      holdExpiresAt,
    });
  };

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await AuthApi.logout();
    } catch {
      // Clear local auth state even if the API is temporarily unreachable.
    } finally {
      setAuthUser(null);
      setActiveTab('browse');
      setHeldBooking(null);
      setIsLoggingOut(false);
    }
  };

  if (isCheckingSession) {
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

  if (!authUser) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <LoginScreen onAuthenticated={setAuthUser} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      <Tabs
        className="flex-1"
        value={activeTab}
        variant="secondary"
        onValueChange={(value) => setActiveTab(value as CustomerTab)}
      >
        <Tabs.Content className="flex-1" value="browse">
          <BrowseUnitsScreen
            contentBottomPadding={32}
            heldBooking={heldBooking}
            onHold={holdUnits}
          />
        </Tabs.Content>

        <Tabs.Content className="flex-1" value="bookings">
          <MyBookingsScreen
            contentBottomPadding={32}
            heldBooking={heldBooking}
            remaining={remaining}
            onBrowse={() => setActiveTab('browse')}
          />
        </Tabs.Content>

        <Tabs.Content className="flex-1" value="settings">
          <SettingsScreen user={authUser} isLoggingOut={isLoggingOut} onLogout={logout} />
        </Tabs.Content>

        {heldBooking ? (
          <View className="border-t border-border bg-surface px-4 py-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-xs text-muted">
                  Đang giữ {heldBooking.units.length} kho · {heldBooking.id}
                </Text>
                <Text className="mt-1 font-mono text-lg font-bold text-accent">{remaining}</Text>
              </View>
              <Button size="sm" variant="tertiary" onPress={() => setHeldBooking(null)}>
                <Button.Label>Hủy giữ</Button.Label>
              </Button>
              <Button size="sm" onPress={() => setActiveTab('bookings')}>
                <Button.Label>Xem booking</Button.Label>
              </Button>
            </View>
          </View>
        ) : null}

        <View className="border-t border-border bg-surface px-3 pb-1 pt-1.5">
          <Tabs.List background={null} className="w-full rounded-none bg-transparent p-0">
            <Tabs.Trigger
              accessibilityLabel="Browse units"
              className="min-h-14 flex-1"
              value="browse"
            >
              {({ isSelected }) => (
                <View className="items-center gap-1">
                  <UnitsIcon color={isSelected ? accentColor : mutedColor} />
                  <Tabs.Label
                    className={isSelected ? 'text-xs font-bold text-accent' : 'text-xs text-muted'}
                  >
                    Browse units
                  </Tabs.Label>
                </View>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger
              accessibilityLabel="Booking của tôi"
              className="min-h-14 flex-1"
              value="bookings"
            >
              {({ isSelected }) => (
                <View className="items-center gap-1">
                  <View>
                    <BookingIcon color={isSelected ? accentColor : mutedColor} />
                    {heldBooking ? (
                      <View className="absolute -right-3 -top-2 min-w-5 items-center rounded-full bg-accent px-1">
                        <Text className="text-[10px] font-bold text-accent-foreground">
                          {heldBooking.units.length}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Tabs.Label
                    className={isSelected ? 'text-xs font-bold text-accent' : 'text-xs text-muted'}
                  >
                    Booking của tôi
                  </Tabs.Label>
                </View>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger accessibilityLabel="Cài đặt" className="min-h-14 flex-1" value="settings">
              {({ isSelected }) => (
                <View className="items-center gap-1">
                  <SettingsIcon color={isSelected ? accentColor : mutedColor} />
                  <Tabs.Label
                    className={isSelected ? 'text-xs font-bold text-accent' : 'text-xs text-muted'}
                  >
                    Cài đặt
                  </Tabs.Label>
                </View>
              )}
            </Tabs.Trigger>
          </Tabs.List>
        </View>
      </Tabs>
    </SafeAreaView>
  );
}
