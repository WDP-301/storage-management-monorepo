import { Button } from 'heroui-native';
import { Hourglass, Lock, ShieldCheck } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { primaryRoleLabel } from '../../../lib/app-area';
import type { AuthUser } from '../../types/auth';

type Props = {
  user: AuthUser;
  isLoggingOut: boolean;
  onLogout: () => void;
  onSupport?: () => void;
  rentalUnitCount?: number | null;
  pendingDepositCount?: number | null;
};

/** Mirror the colour tokens in global.css; SVG icons cannot read a Tailwind class. */
const ACCENT = 'hsl(203 100% 30%)';
const MUTED = 'hsl(215 16% 47%)';

export function SettingsScreen({
  user,
  isLoggingOut,
  onLogout,
  onSupport,
  rentalUnitCount,
  pendingDepositCount,
}: Props) {
  const initial = user.fullName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-6 pt-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pb-3">
          <Text className="font-strong text-foreground text-title-md">Tài khoản</Text>
          <Text className="font-body mt-1 text-body-sm text-muted">
            Thông tin tài khoản của bạn
          </Text>
        </View>

        {/* Identity first: name, how we reach you, and which side of the app you are on. */}
        <View className="mx-4 gap-3 rounded-xl border border-border bg-surface p-3">
          <View className="flex-row items-center gap-3">
            <View className="size-12 items-center justify-center rounded-full bg-accent/10">
              <Text className="font-display text-accent text-title-sm">{initial}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-strong text-foreground text-body-lg">{user.fullName}</Text>
              {user.phone ? (
                <Text className="font-numeric mt-0.5 text-num-sm text-muted">{user.phone}</Text>
              ) : null}
              <Text className="font-body text-body-sm text-muted" numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <View className="rounded-full bg-surface-secondary px-2.5 py-1">
              <Text className="font-ui text-caption text-subtle">
                {primaryRoleLabel(user.roles)}
              </Text>
            </View>
          </View>

          <View className="h-px bg-separator" />

          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-body text-body-sm text-muted">Số điện thoại</Text>
            <Text className="font-strong text-body-sm text-foreground">
              {user.phone || 'Chưa cập nhật'}
            </Text>
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-body text-body-sm text-muted">Trạng thái tài khoản</Text>
            <View className="rounded-full bg-success-bg px-2 py-0.5">
              <Text className="font-ui text-caption text-success">Đang hoạt động</Text>
            </View>
          </View>
        </View>

        {rentalUnitCount !== undefined ? (
          <View className="mx-4 mt-4 flex-row rounded-xl bg-surface-secondary p-3">
            <AccountStat
              icon={<Lock color={ACCENT} size={18} />}
              value={rentalUnitCount === null ? '—' : `${rentalUnitCount} kho`}
              label="Đã xác nhận thuê"
            />
            <View className="w-px bg-separator" />
            <AccountStat
              icon={<Hourglass color="hsl(32 95% 44%)" size={18} />}
              value={pendingDepositCount == null ? '—' : `${pendingDepositCount} đơn`}
              label="Chờ chuyển cọc"
            />
            <View className="w-px bg-separator" />
            <AccountStat
              icon={<ShieldCheck color={MUTED} size={18} />}
              value="—"
              label="Vi phạm hợp đồng"
            />
          </View>
        ) : null}
        <View className="mx-4 mt-4 rounded-xl border border-border bg-surface px-3">
          <SettingItem title="Thông báo" description="Booking, thanh toán và nhắc lịch" />
          <View className="h-px bg-separator" />
          <SettingItem title="Bảo mật" description="Mật khẩu và phiên đăng nhập" />
          <View className="h-px bg-separator" />
          <SettingItem title="Hỗ trợ" description="Liên hệ và yêu cầu hỗ trợ" onPress={onSupport} />
        </View>
      </ScrollView>
      <View className="border-border border-t bg-background px-4 py-3">
        <Button isDisabled={isLoggingOut} variant="danger-soft" onPress={onLogout}>
          <Button.Label className="font-ui">
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất tài khoản'}
          </Button.Label>
        </Button>
      </View>
    </View>
  );
}

function SettingItem({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <View className="flex-row items-center justify-between py-3">
        <View className="flex-1">
          <Text className="font-strong text-foreground">{title}</Text>
          <Text className="font-body mt-1 text-caption text-muted">{description}</Text>
        </View>
        <Text className="font-body text-title-sm text-muted">›</Text>
      </View>
    </Pressable>
  );
}

function AccountStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View className="flex-1 items-center gap-1 px-1">
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Text className="font-numeric text-num-sm text-foreground">{value}</Text>
      </View>
      <Text className="font-body text-center text-caption text-muted">{label}</Text>
    </View>
  );
}
