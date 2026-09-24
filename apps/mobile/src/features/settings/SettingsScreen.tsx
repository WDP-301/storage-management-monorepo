import { Button, Card, Chip } from 'heroui-native';
import { ScrollView, Text, View } from 'react-native';
import type { AuthUser } from '../../types/auth';

type Props = {
  user: AuthUser;
  isLoggingOut: boolean;
  onLogout: () => void;
};

export function SettingsScreen({ user, isLoggingOut, onLogout }: Props) {
  const initial = user.fullName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <ScrollView contentContainerClassName="px-4 pb-8 pt-5" showsVerticalScrollIndicator={false}>
      <Text className="text-2xl font-bold tracking-tight text-foreground">Cài đặt</Text>
      <Text className="mt-1 text-sm leading-5 text-muted">
        Quản lý tài khoản và tùy chọn ứng dụng.
      </Text>

      <Card className="mt-5 border border-border bg-surface">
        <Card.Body className="gap-4">
          <View className="flex-row items-center gap-3">
            <View className="size-12 items-center justify-center rounded-2xl bg-accent">
              <Text className="text-lg font-black text-accent-foreground">{initial}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-foreground">{user.fullName}</Text>
              <Text className="mt-0.5 text-sm text-muted">{user.email}</Text>
            </View>
            <Chip color="accent" size="sm" variant="soft">
              <Chip.Label>Khách hàng</Chip.Label>
            </Chip>
          </View>

          <View className="h-px bg-separator" />
          <SettingValue label="Số điện thoại" value={user.phone || 'Chưa cập nhật'} />
          <SettingValue label="Trạng thái tài khoản" value="Đang hoạt động" />
        </Card.Body>
      </Card>

      <Card className="mt-4 border border-border bg-surface">
        <Card.Body className="gap-1">
          <SettingItem title="Thông báo" description="Booking, thanh toán và nhắc lịch" />
          <View className="h-px bg-separator" />
          <SettingItem title="Bảo mật" description="Mật khẩu và phiên đăng nhập" />
          <View className="h-px bg-separator" />
          <SettingItem title="Hỗ trợ" description="Liên hệ và yêu cầu hỗ trợ" />
        </Card.Body>
      </Card>

      <Button
        className="mt-5 w-full"
        isDisabled={isLoggingOut}
        variant="danger-soft"
        onPress={onLogout}
      >
        <Button.Label>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</Button.Label>
      </Button>
    </ScrollView>
  );
}

function SettingValue({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-1">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}

function SettingItem({ title, description }: { title: string; description: string }) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-1">
        <Text className="font-semibold text-foreground">{title}</Text>
        <Text className="mt-1 text-xs text-muted">{description}</Text>
      </View>
      <Text className="text-lg text-muted">›</Text>
    </View>
  );
}
