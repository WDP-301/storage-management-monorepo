import { Pressable, ScrollView, View } from 'react-native';
import { Button, FlowScreen, Icon, InlineMessage, Input, Text } from '../../components/ui';
import colors from '../../components/ui/colors';

export type AuthMode = 'login' | 'register';
export type AuthValues = { email: string; password: string; fullName: string; phone: string };
export type AuthFieldErrors = Partial<Record<keyof AuthValues, string>>;

type Props = {
  mode: AuthMode;
  values: AuthValues;
  errors: AuthFieldErrors;
  submitError: string | null;
  isSubmitting: boolean;
  onChange: (field: keyof AuthValues, value: string) => void;
  onBack: () => void;
  onSwitch: () => void;
  onSubmit: () => void;
};

export function AuthFormScreen({
  mode,
  values,
  errors,
  submitError,
  isSubmitting,
  onChange,
  onBack,
  onSwitch,
  onSubmit,
}: Props) {
  const isRegister = mode === 'register';

  return (
    <FlowScreen
      backLabel="Quay lại trang giới thiệu"
      onBack={onBack}
      title={isRegister ? 'Đăng ký tài khoản' : 'Đăng nhập'}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-4 pt-5 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1.5">
          <Text className="text-heading font-bold text-text-primary">
            {isRegister ? 'Tạo tài khoản thuê kho' : 'Chào mừng trở lại'}
          </Text>
          <Text className="text-body text-text-secondary">
            {isRegister
              ? 'Đăng ký bằng số điện thoại để quản lý đặt chỗ và nhận thông tin kho.'
              : 'Nhập email và mật khẩu để quản lý kho thuê và các đặt chỗ của bạn.'}
          </Text>
        </View>

        <View className="mt-6 gap-4">
          {isRegister ? (
            <>
              <Input
                autoCapitalize="words"
                autoComplete="name"
                clearable
                error={errors.fullName}
                label="Họ và tên"
                leftIcon="person-outline"
                onChangeText={(value) => onChange('fullName', value)}
                placeholder="Nguyễn Văn An"
                required
                value={values.fullName}
              />
              <Input
                autoComplete="tel"
                clearable
                error={errors.phone}
                keyboardType="phone-pad"
                label="Số điện thoại"
                leftSlot={
                  <View className="mr-1 border-r border-border-default pr-2.5">
                    <Text className="text-caption font-semibold text-text-brand">VN +84</Text>
                  </View>
                }
                maxLength={16}
                onChangeText={(value) => onChange('phone', value)}
                placeholder="908 123 456"
                required
                value={values.phone}
              />
            </>
          ) : null}

          <Input
            autoCapitalize="none"
            autoComplete="email"
            clearable
            error={errors.email}
            keyboardType="email-address"
            label="Email"
            leftIcon="mail-outline"
            onChangeText={(value) => onChange('email', value)}
            placeholder="customer@example.com"
            required
            value={values.email}
          />

          <Input
            autoCapitalize="none"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            error={errors.password}
            label="Mật khẩu"
            leftIcon="lock-outline"
            onChangeText={(value) => onChange('password', value)}
            onSubmitEditing={onSubmit}
            passwordToggle
            placeholder={isRegister ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'}
            required
            returnKeyType="go"
            value={values.password}
          />

          {isRegister ? <PasswordHint isValid={values.password.length >= 8} /> : null}

          {submitError ? (
            <View className="rounded-xl bg-danger-0 px-3.5 py-3">
              <InlineMessage message={submitError} type="error" />
            </View>
          ) : null}

          <View className="mt-2">
            <Button
              label={
                isSubmitting
                  ? isRegister
                    ? 'Đang tạo tài khoản...'
                    : 'Đang đăng nhập...'
                  : isRegister
                    ? 'Đăng ký tài khoản'
                    : 'Đăng nhập'
              }
              loading={isSubmitting}
              onPress={onSubmit}
              rightIcon={isSubmitting ? undefined : 'arrow-forward'}
              size="lg"
            />
          </View>
        </View>

        <View className="mt-8 flex-row flex-wrap items-center justify-center gap-1">
          <Text className="text-body text-text-secondary">
            {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản thuê kho?'}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="rounded-full px-2 py-1"
            onPress={onSwitch}
          >
            <Text className="text-body font-semibold text-text-link">
              {isRegister ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </FlowScreen>
  );
}

function PasswordHint({ isValid }: { isValid: boolean }) {
  return (
    <View className="-mt-1 flex-row items-center gap-1.5">
      <View
        className={`h-1 flex-1 rounded-full ${isValid ? 'bg-status-success-solid' : 'bg-border-default'}`}
      />
      <View
        className={`h-1 flex-1 rounded-full ${isValid ? 'bg-status-success-solid' : 'bg-border-default'}`}
      />
      <View
        className={`h-1 flex-1 rounded-full ${isValid ? 'bg-status-success-solid' : 'bg-border-default'}`}
      />
      <View
        className={`h-1 flex-1 rounded-full ${isValid ? 'bg-status-success-solid' : 'bg-border-default'}`}
      />
      <Icon
        color={isValid ? colors.semantic.statusSuccess : colors.semantic.textSecondary}
        name="check-circle"
        size={15}
      />
      <Text
        className={`text-caption font-medium ${isValid ? 'text-status-success' : 'text-text-secondary'}`}
      >
        Tối thiểu 8 ký tự
      </Text>
    </View>
  );
}
