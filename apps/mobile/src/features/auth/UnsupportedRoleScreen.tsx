import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
import { primaryRoleLabel } from '../../../lib/app-area';
import type { AuthUser } from '../../types/auth';

type Props = {
  user: AuthUser;
  isLoggingOut: boolean;
  onLogout: () => void;
};

/** Shown to accounts whose roles have no mobile area (operations manager, admin, no role). */
export function UnsupportedRoleScreen({ user, isLoggingOut, onLogout }: Props) {
  return (
    <View className="flex-1 justify-between px-5 pb-8 pt-10">
      <View>
        <View className="size-12 items-center justify-center rounded-2xl bg-warning/15">
          <Text className="text-lg font-black text-warning">!</Text>
        </View>
        <Text className="mt-7 text-2xl font-bold tracking-tight text-foreground">
          Tài khoản chưa hỗ trợ trên ứng dụng di động
        </Text>
        <Text className="mt-3 text-base leading-6 text-muted">
          Tài khoản {user.email} có vai trò {primaryRoleLabel(user.roles)}. Vai trò này làm việc
          trên trang quản trị web. Vui lòng đăng nhập bằng trình duyệt để tiếp tục.
        </Text>
      </View>

      <Button className="w-full" isDisabled={isLoggingOut} size="lg" onPress={onLogout}>
        <Button.Label>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</Button.Label>
      </Button>
    </View>
  );
}
