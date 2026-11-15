import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { primaryRoleLabel } from '../../../lib/app-area';
import { Button, Icon, Text } from '../../components/ui';
import colors from '../../components/ui/colors';
import type { AuthUser } from '../../types/auth';

type Props = {
  user: AuthUser;
  isLoggingOut: boolean;
  onLogout: () => void;
};

/** Shown to accounts whose roles have no mobile area (operations manager, admin, no role). */
export function UnsupportedRoleScreen({ user, isLoggingOut, onLogout }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 justify-between bg-bg-page px-5 pt-10"
      style={{ paddingBottom: Math.max(insets.bottom, 24) }}
    >
      <View>
        <View className="size-14 items-center justify-center rounded-2xl bg-warning-0">
          <Icon color={colors.warning[700]} name="warning-amber" size={28} />
        </View>
        <Text className="mt-6 text-heading font-bold text-text-primary">
          Tài khoản chưa hỗ trợ trên ứng dụng di động
        </Text>
        <Text className="mt-3 text-body-lg leading-6 text-text-secondary">
          Tài khoản <Text className="font-semibold text-text-primary">{user.email}</Text> có vai trò{' '}
          <Text className="font-semibold text-text-primary">{primaryRoleLabel(user.roles)}</Text>.
          Vai trò này làm việc trên trang quản trị web. Vui lòng đăng nhập bằng trình duyệt để tiếp
          tục.
        </Text>
      </View>

      <Button
        label={isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
        loading={isLoggingOut}
        onPress={onLogout}
        size="lg"
        variant="destructive"
      />
    </View>
  );
}
