import { Button } from 'heroui-native';
import { ArrowRight, QrCode, Ruler, SquaresFour } from 'phosphor-react-native';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onLogin: () => void;
  onRegister: () => void;
};

const FEATURES = [
  {
    icon: SquaresFour,
    title: 'Thuê nhiều kho trong một lần đặt',
    badge: 'Tiện lợi gom kho',
    badgeClass: 'bg-accent/10 text-accent',
    description: 'Chọn nhiều kho trong một lượt và xem rõ vị trí của từng kho trên bản đồ.',
  },
  {
    icon: Ruler,
    title: 'Biết rõ kích thước & chi phí',
    badge: 'Thông tin rõ ràng',
    badgeClass: 'bg-success-bg text-success',
    description: 'Xem diện tích, kích thước và giá thuê niêm yết theo tháng.',
  },
  {
    icon: QrCode,
    title: 'Giữ chỗ & cọc nhanh bằng VietQR',
    badge: 'Thanh toán trực tiếp',
    badgeClass: 'bg-surface-secondary text-subtle',
    description: 'Giữ kho, quét mã VietQR và theo dõi trạng thái thanh toán ngay trong app.',
  },
] as const;

export function WelcomeScreen({ onLogin, onRegister }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-4 pt-3"
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-2xl border border-border/40 bg-surface p-4 shadow-sm">
          <Text className="font-numeric text-caption text-muted uppercase tracking-widest">
            Giải pháp kho tự quản cá nhân
          </Text>
          <Text className="font-display mt-2 text-title-lg text-foreground">
            Tìm và giữ kho tự quản theo nhu cầu của bạn
          </Text>
          <Text className="font-body mt-2 text-body-md text-subtle">
            Thuê kho nhỏ chứa đồ dọn nhà, đồ gia đình hoặc lưu hàng kinh doanh. Xem vị trí, chọn
            nhiều kho cùng lúc và thanh toán cọc nhanh qua VietQR.
          </Text>
        </View>

        <View className="mt-3 gap-2">
          {FEATURES.map(({ icon: Icon, title, badge, badgeClass, description }) => (
            <View
              key={title}
              className="flex-row gap-3 rounded-2xl border border-border/40 bg-surface p-3 shadow-sm"
            >
              <View className="size-9 items-center justify-center rounded-lg bg-surface-secondary">
                <Icon color="#334155" size={20} weight="bold" />
              </View>
              <View className="flex-1 items-start">
                <Text className="font-strong text-body-md text-foreground">{title}</Text>
                <Text className="font-body mt-0.5 text-body-sm text-muted">{description}</Text>
                <Text
                  className={`mt-2 overflow-hidden rounded-full px-2 py-0.5 font-ui text-caption ${badgeClass}`}
                >
                  {badge}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        className="gap-2 border-t border-border/40 bg-background px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
      >
        <Button className="w-full bg-foreground" size="lg" onPress={onRegister}>
          <Button.Label className="font-ui text-surface">Đăng ký tài khoản mới</Button.Label>
          <ArrowRight color="white" size={18} weight="bold" />
        </Button>
        <Button className="w-full" size="lg" variant="secondary" onPress={onLogin}>
          <Button.Label className="font-ui">Đăng nhập</Button.Label>
        </Button>
      </View>
    </View>
  );
}
