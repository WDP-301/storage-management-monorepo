import { Button, FieldError, Input, Label, TextField } from 'heroui-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { ApiError, AuthApi } from '../../../lib/api';
import type { AuthUser } from '../../types/auth';

type AuthMode = 'login' | 'register';
type FieldErrors = Partial<Record<'email' | 'password' | 'fullName' | 'phone', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIETNAMESE_PHONE_PATTERN = /^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/;

export function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFieldErrors({});
    setSubmitError(null);
  };

  const submit = async () => {
    const errors = validateForm({ mode, email, password, fullName, phone });
    setFieldErrors(errors);
    setSubmitError(null);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const user =
        mode === 'login'
          ? await AuthApi.login({ email: email.trim(), password })
          : await AuthApi.register({
              email: email.trim(),
              password,
              fullName: fullName.trim(),
              phone: phone.trim(),
            });
      onAuthenticated(user);
    } catch (error) {
      setSubmitError(toUserMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-between px-5 pb-8 pt-10"
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <View className="size-12 items-center justify-center rounded-2xl bg-accent">
            <Text className="text-lg font-black text-accent-foreground">S</Text>
          </View>
          <Text className="mt-7 text-3xl font-bold tracking-tight text-foreground">
            {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </Text>
          <Text className="mt-2 max-w-sm text-base leading-6 text-muted">
            {mode === 'login'
              ? 'Đăng nhập để tìm kho và quản lý booking của bạn.'
              : 'Tạo tài khoản khách hàng để bắt đầu đặt kho.'}
          </Text>

          <View className="mt-8 gap-5">
            {mode === 'register' ? (
              <>
                <TextField isInvalid={Boolean(fieldErrors.fullName)} isRequired>
                  <Label>Họ và tên</Label>
                  <Input
                    autoCapitalize="words"
                    autoComplete="name"
                    placeholder="Nguyễn Văn A"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                  {fieldErrors.fullName ? <FieldError>{fieldErrors.fullName}</FieldError> : null}
                </TextField>
                <TextField isInvalid={Boolean(fieldErrors.phone)} isRequired>
                  <Label>Số điện thoại</Label>
                  <Input
                    autoComplete="tel"
                    keyboardType="phone-pad"
                    placeholder="0912345678"
                    value={phone}
                    onChangeText={setPhone}
                  />
                  {fieldErrors.phone ? <FieldError>{fieldErrors.phone}</FieldError> : null}
                </TextField>
              </>
            ) : null}

            <TextField isInvalid={Boolean(fieldErrors.email)} isRequired>
              <Label>Email</Label>
              <Input
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
              />
              {fieldErrors.email ? <FieldError>{fieldErrors.email}</FieldError> : null}
            </TextField>

            <TextField isInvalid={Boolean(fieldErrors.password)} isRequired>
              <Label>Mật khẩu</Label>
              <Input
                autoCapitalize="none"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'login' ? 'Nhập mật khẩu' : 'Tối thiểu 8 ký tự'}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {fieldErrors.password ? <FieldError>{fieldErrors.password}</FieldError> : null}
            </TextField>

            {submitError ? (
              <View className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-3">
                <Text className="text-sm leading-5 text-danger">{submitError}</Text>
              </View>
            ) : null}

            <Button className="w-full" isDisabled={isSubmitting} size="lg" onPress={submit}>
              <Button.Label>
                {isSubmitting
                  ? mode === 'login'
                    ? 'Đang đăng nhập...'
                    : 'Đang tạo tài khoản...'
                  : mode === 'login'
                    ? 'Đăng nhập'
                    : 'Đăng ký'}
              </Button.Label>
            </Button>
          </View>
        </View>

        <View className="mt-10 items-center">
          <Text className="text-sm text-muted">
            {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          </Text>
          <Button
            className="mt-1"
            size="sm"
            variant="ghost"
            onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
          >
            <Button.Label>{mode === 'login' ? 'Đăng ký ngay' : 'Quay lại đăng nhập'}</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function validateForm({
  mode,
  email,
  password,
  fullName,
  phone,
}: {
  mode: AuthMode;
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Email không hợp lệ.';
  if (!password) errors.password = 'Vui lòng nhập mật khẩu.';

  if (mode === 'register') {
    if (!fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.';
    if (!VIETNAMESE_PHONE_PATTERN.test(phone.trim())) {
      errors.phone = 'Số điện thoại Việt Nam không hợp lệ.';
    }
    if (password.length < 8 || password.length > 72) {
      errors.password = 'Mật khẩu phải có từ 8 đến 72 ký tự.';
    }
  }

  return errors;
}

function toUserMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  if (error.message === 'Invalid email or password') return 'Email hoặc mật khẩu không đúng.';
  if (error.message === 'Email is already registered') return 'Email này đã được đăng ký.';
  return error.message;
}
