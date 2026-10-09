import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { ApiError, AuthApi } from '../../../lib/api';
import type { AuthUser } from '../../types/auth';
import {
  type AuthFieldErrors,
  AuthFormScreen,
  type AuthMode,
  type AuthValues,
} from './AuthFormScreen';
import { WelcomeScreen } from './WelcomeScreen';

type Screen = 'welcome' | AuthMode;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Match the mobile prefixes accepted by the existing registration API.
const VIETNAMESE_PHONE_PATTERN =
  /^\+84(?:32|33|34|35|36|37|38|39|52|55|56|58|59|70|76|77|78|79|81|82|83|84|85|86|87|88|89|90|91|92|93|94|96|97|98|99)\d{7}$/;

export function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [values, setValues] = useState<AuthValues>({
    email: '',
    password: '',
    fullName: '',
    phone: '',
  });
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showScreen = (next: Screen) => {
    setScreen(next);
    setFieldErrors({});
    setSubmitError(null);
  };

  const changeField = (field: keyof AuthValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const submit = async () => {
    if (screen === 'welcome' || isSubmitting) return;
    const errors = validateForm(screen, values);
    setFieldErrors(errors);
    setSubmitError(null);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const user =
        screen === 'login'
          ? await AuthApi.login({ email: values.email.trim(), password: values.password })
          : await AuthApi.register({
              email: values.email.trim(),
              password: values.password,
              fullName: values.fullName.trim(),
              phone: normalizePhone(values.phone),
            });
      onAuthenticated(user);
    } catch (error) {
      setSubmitError(toUserMessage(error, screen));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onLogin={() => showScreen('login')}
        onRegister={() => showScreen('register')}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <AuthFormScreen
        mode={screen}
        values={values}
        errors={fieldErrors}
        submitError={submitError}
        isSubmitting={isSubmitting}
        onChange={changeField}
        onBack={() => showScreen('welcome')}
        onSwitch={() => showScreen(screen === 'login' ? 'register' : 'login')}
        onSubmit={() => void submit()}
      />
    </KeyboardAvoidingView>
  );
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const national =
    digits.startsWith('84') && digits.length >= 11
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return `+84${national}`;
}

function validateForm(mode: AuthMode, values: AuthValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (!EMAIL_PATTERN.test(values.email.trim()) || values.email.trim().length > 255) {
    errors.email = 'Email không hợp lệ.';
  }
  if (!values.password) errors.password = 'Vui lòng nhập mật khẩu.';

  if (mode === 'register') {
    if (!values.fullName.trim() || values.fullName.trim().length > 150) {
      errors.fullName = 'Vui lòng nhập họ và tên (tối đa 150 ký tự).';
    }
    if (!VIETNAMESE_PHONE_PATTERN.test(normalizePhone(values.phone))) {
      errors.phone = 'Số điện thoại Việt Nam không hợp lệ.';
    }
    if (values.password.length < 8 || values.password.length > 72) {
      errors.password = 'Mật khẩu phải có từ 8 đến 72 ký tự.';
    }
  }
  return errors;
}

function toUserMessage(error: unknown, mode: AuthMode) {
  if (!(error instanceof ApiError)) return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  if (mode === 'login' && error.statusCode === 401) return 'Email hoặc mật khẩu không đúng.';
  return error.message;
}
