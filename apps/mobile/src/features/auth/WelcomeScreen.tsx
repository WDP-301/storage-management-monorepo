import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, type IconName, StatusPill, Text } from '../../components/ui';
import colors from '../../components/ui/colors';

type Props = {
  onLogin: () => void;
  onRegister: () => void;
};

const FEATURES: {
  icon: IconName;
  title: string;
  badge: string;
  tone: 'info' | 'success' | 'neutral';
  description: string;
}[] = [
  {
    icon: 'grid-view',
    title: 'Thuê nhiều kho trong một lần đặt',
    badge: 'Tiện lợi gom kho',
    tone: 'info',
    description: 'Chọn nhiều kho hoặc kệ trong một lượt và xem rõ vị trí trên bản đồ.',
  },
  {
    icon: 'straighten',
    title: 'Biết rõ kích thước & chi phí',
    badge: 'Thông tin rõ ràng',
    tone: 'success',
    description: 'Xem diện tích, kích thước và giá thuê niêm yết minh bạch theo tháng.',
  },
  {
    icon: 'qr-code-2',
    title: 'Giữ chỗ & cọc nhanh bằng VietQR',
    badge: 'Thanh toán trực tiếp',
    tone: 'neutral',
    description: 'Giữ kho, quét mã VietQR và theo dõi trạng thái thanh toán ngay trong app.',
  },
];

export function WelcomeScreen({ onLogin, onRegister }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-bg-muted">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pt-5 pb-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3 rounded-2xl bg-primary-500 p-5">
          <View className="self-start rounded-full bg-white/15 px-3 py-1">
            <Text className="text-caption font-semibold text-text-inverse uppercase">
              Giải pháp kho tự quản cá nhân
            </Text>
          </View>
          <Text className="text-heading font-bold text-text-inverse">
            Tìm và giữ kho tự quản theo nhu cầu của bạn
          </Text>
          <Text className="text-body leading-5 text-secondary-50">
            Thuê kho nhỏ chứa đồ dọn nhà, đồ gia đình hoặc lưu hàng kinh doanh. Xem vị trí, chọn
            nhiều kho cùng lúc và thanh toán cọc nhanh qua VietQR.
          </Text>
        </View>

        <View className="gap-3">
          {FEATURES.map((item) => (
            <View key={item.title} className="flex-row gap-3 rounded-2xl bg-bg-card p-4">
              <View className="size-11 items-center justify-center rounded-xl bg-secondary-0">
                <Icon color={colors.semantic.textLink} name={item.icon} size={22} />
              </View>
              <View className="flex-1 gap-1.5">
                <StatusPill label={item.badge} tone={item.tone} />
                <Text className="text-lead font-semibold text-text-primary">{item.title}</Text>
                <Text className="text-body text-text-secondary">{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        className="gap-2.5 border-t border-border-default bg-bg-card px-4 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 20) }}
      >
        <Button label="Đăng nhập" onPress={onLogin} size="lg" />
        <Button label="Đăng ký tài khoản mới" onPress={onRegister} size="lg" variant="secondary" />
      </View>
    </View>
  );
}
