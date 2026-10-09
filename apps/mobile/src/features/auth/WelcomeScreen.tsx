import { Button } from 'heroui-native';
import { ArrowRight, QrCode, Ruler, SquaresFour } from 'phosphor-react-native';
import { ScrollView, Text, View } from 'react-native';

type Props = {
  onLogin: () => void;
  onRegister: () => void;
};

const FEATURES = [
  {
    icon: SquaresFour,
    title: 'Thuê nhiều kho cùng một cơ sở',
    badge: 'Tiện lợi gom kho',
    badgeClass: 'bg-accent/10 text-accent',
    description: 'Chọn nhiều kho trong một lượt và xem rõ vị trí của từng cơ sở.',
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
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="flex-grow justify-between px-4 pb-5 pt-3"
      showsVerticalScrollIndicator={false}
    >
      <View>
        <View className="mb-4 h-1 w-4 rounded-full bg-border" />
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

        <View className="mt-4 gap-2">
          {FEATURES.map(({ icon: Icon, title, badge, badgeClass, description }) => (
            <View
              key={title}
              className="flex-row gap-3 rounded-2xl border border-border/40 bg-surface p-3 shadow-sm"
            >
              <View className="size-9 items-center justify-center rounded-lg bg-surface-secondary">
                <Icon color="#334155" size={20} weight="bold" />
              </View>
              <View className="flex-1">
                <View className="flex-row flex-wrap items-start justify-between gap-1">
                  <Text className="max-w-[65%] font-strong text-body-md text-foreground">
                    {title}
                  </Text>
                  <Text
                    className={`max-w-[35%] rounded-md px-1.5 py-1 font-ui text-caption ${badgeClass}`}
                  >
                    {badge}
                  </Text>
                </View>
                <Text className="font-body mt-1 text-body-sm text-muted">{description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="mt-5 gap-2">
        <Button className="w-full bg-foreground" size="lg" onPress={onRegister}>
          <Button.Label className="font-ui text-surface">Đăng ký tài khoản mới</Button.Label>
          <ArrowRight color="white" size={18} weight="bold" />
        </Button>
        <Button className="w-full" size="lg" variant="secondary" onPress={onLogin}>
          <Button.Label className="font-ui">Đăng nhập</Button.Label>
        </Button>
      </View>
    </ScrollView>
  );
}
