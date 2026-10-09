import { Button } from 'heroui-native';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Envelope,
  Eye,
  EyeSlash,
  Lock,
  User,
  UserCircle,
} from 'phosphor-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, type TextInputProps, View } from 'react-native';

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

const ICON_COLOR = '#64748b';

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
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === 'register';

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="flex-grow px-4 pb-6"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="-mx-4 flex-row items-center justify-between bg-background px-4 py-2">
        <View className="flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại trang giới thiệu"
            className="size-11 items-center justify-center rounded-full"
            onPress={onBack}
          >
            <ArrowLeft color="#0f172a" size={22} weight="bold" />
          </Pressable>
          <Text className="font-strong text-title-sm text-foreground">
            {isRegister ? 'Đăng ký' : 'Đăng nhập'}
          </Text>
        </View>
        <View className="size-8 items-center justify-center rounded-full bg-foreground">
          <UserCircle color="white" size={20} weight="fill" />
        </View>
      </View>

      <View className="pt-6">
        <Text className="font-display text-title-lg text-foreground">
          {isRegister ? 'Tạo tài khoản thuê kho' : 'Đăng nhập tài khoản'}
        </Text>
        <Text className="font-body mt-1 text-body-md text-muted">
          {isRegister
            ? 'Đăng ký bằng số điện thoại để quản lý đặt chỗ và nhận thông tin kho.'
            : 'Nhập email và mật khẩu để quản lý kho thuê và các đặt chỗ của bạn.'}
        </Text>
      </View>

      <View className="mt-6 gap-4">
        {isRegister ? (
          <>
            <AuthInput
              label="Họ và tên"
              icon={<User color={ICON_COLOR} size={19} />}
              error={errors.fullName}
              value={values.fullName}
              placeholder="Nguyễn Văn An"
              autoCapitalize="words"
              autoComplete="name"
              onChangeText={(value) => onChange('fullName', value)}
            />
            <AuthInput
              label="Số điện thoại"
              prefix="VN +84"
              error={errors.phone}
              value={values.phone}
              placeholder="908 123 456"
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={16}
              onChangeText={(value) => onChange('phone', value)}
            />
          </>
        ) : null}
        <AuthInput
          label="Email"
          icon={<Envelope color={ICON_COLOR} size={19} />}
          error={errors.email}
          value={values.email}
          placeholder="customer@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={(value) => onChange('email', value)}
        />
        <AuthInput
          label="Mật khẩu"
          icon={<Lock color={ICON_COLOR} size={19} />}
          error={errors.password}
          value={values.password}
          placeholder={isRegister ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'}
          autoCapitalize="none"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          secureTextEntry={!showPassword}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          onChangeText={(value) => onChange('password', value)}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="size-11 items-center justify-center"
              onPress={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <EyeSlash color={ICON_COLOR} size={20} />
              ) : (
                <Eye color={ICON_COLOR} size={20} />
              )}
            </Pressable>
          }
        />
        {isRegister ? <PasswordHint isValid={values.password.length >= 8} /> : null}

        {submitError ? (
          <View className="rounded-xl border border-danger/25 bg-danger-bg px-3 py-3">
            <Text className="font-body text-body-sm text-danger">{submitError}</Text>
          </View>
        ) : null}

        <Button className="mt-2 w-full" isDisabled={isSubmitting} size="lg" onPress={onSubmit}>
          <Button.Label className="font-ui">
            {isSubmitting
              ? isRegister
                ? 'Đang tạo tài khoản...'
                : 'Đang đăng nhập...'
              : isRegister
                ? 'Đăng ký tài khoản'
                : 'Đăng nhập'}
          </Button.Label>
          {!isSubmitting ? <ArrowRight color="white" size={19} weight="bold" /> : null}
        </Button>
      </View>

      <View className="mt-8 flex-row flex-wrap items-center justify-center gap-1">
        <Text className="font-body text-body-sm text-muted">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản thuê kho?'}
        </Text>
        <Pressable accessibilityRole="button" className="rounded-full px-2 py-1" onPress={onSwitch}>
          <Text className="font-strong text-body-sm text-foreground underline">
            {isRegister ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function AuthInput({
  label,
  error,
  icon,
  prefix,
  right,
  ...inputProps
}: TextInputProps & {
  label: string;
  error?: string;
  icon?: ReactNode;
  prefix?: string;
  right?: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="font-ui text-caption text-muted uppercase">
        {label} <Text className="text-danger">*</Text>
      </Text>
      <View
        className={`min-h-12 flex-row items-center rounded-xl border bg-surface px-3 ${error ? 'border-danger' : 'border-border/50'}`}
      >
        {icon ? <View className="mr-2">{icon}</View> : null}
        {prefix ? (
          <View className="mr-3 border-separator border-r pr-3">
            <Text className="font-numeric text-caption text-foreground">{prefix}</Text>
          </View>
        ) : null}
        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          className="h-12 flex-1 font-body text-body-md text-foreground"
          placeholderTextColor={ICON_COLOR}
        />
        {right}
      </View>
      {error ? <Text className="font-body text-caption text-danger">{error}</Text> : null}
    </View>
  );
}

function PasswordHint({ isValid }: { isValid: boolean }) {
  return (
    <View className="-mt-1 flex-row items-center gap-1.5">
      <View className={`h-1 flex-1 rounded-full ${isValid ? 'bg-success' : 'bg-border'}`} />
      <View className={`h-1 flex-1 rounded-full ${isValid ? 'bg-success' : 'bg-border'}`} />
      <View className={`h-1 flex-1 rounded-full ${isValid ? 'bg-success' : 'bg-border'}`} />
      <View className={`h-1 flex-1 rounded-full ${isValid ? 'bg-success' : 'bg-border'}`} />
      <Check color={isValid ? '#059669' : ICON_COLOR} size={15} weight="bold" />
      <Text className={`font-ui text-caption ${isValid ? 'text-success' : 'text-muted'}`}>
        Tối thiểu 8 ký tự
      </Text>
    </View>
  );
}
