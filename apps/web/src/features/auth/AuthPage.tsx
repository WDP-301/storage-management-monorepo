import { Button, Input, Tabs, Text } from '@cloudflare/kumo';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDefaultPath } from '../../lib/roles';

type AuthMode = 'login' | 'register';
type FieldErrors = Partial<Record<'email' | 'password' | 'fullName' | 'phone', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Vietnamese mobile number: 0/+84/84 prefix followed by a 3/5/7/8/9 network prefix. */
const VIETNAMESE_PHONE_PATTERN = /^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/;

interface AuthPageProps {
  initialMode?: AuthMode;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login' }) => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode is synchronized with the URL pathname
  const mode: AuthMode = location.pathname === '/register' ? 'register' : initialMode;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const switchMode = (newMode: AuthMode) => {
    setFieldErrors({});
    setServerError(null);
    setSuccessMessage(null);
    navigate(newMode === 'register' ? '/register' : '/login');
  };

  React.useEffect(() => {
    setFieldErrors({});
    setServerError(null);
    setSuccessMessage(null);
  }, [location.pathname]);

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!email.trim()) {
      errors.email = 'Vui lòng nhập địa chỉ email.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = 'Định dạng email không hợp lệ (ví dụ: user@example.com).';
    }

    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    } else if (mode === 'register' && (password.length < 8 || password.length > 72)) {
      errors.password = 'Mật khẩu phải từ 8 đến 72 ký tự.';
    }

    if (mode === 'register') {
      if (!fullName.trim()) {
        errors.fullName = 'Vui lòng nhập họ và tên.';
      }

      if (!phone.trim()) {
        errors.phone = 'Vui lòng nhập số điện thoại.';
      } else if (!VIETNAMESE_PHONE_PATTERN.test(phone.trim())) {
        errors.phone = 'Số điện thoại Việt Nam không hợp lệ (ví dụ: 0912345678).';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const locationState = location.state as {
        from?: { pathname?: string; search?: string } | string;
      } | null;
      const fromPath =
        typeof locationState?.from === 'string'
          ? locationState.from
          : locationState?.from?.pathname
            ? `${locationState.from.pathname}${locationState.from.search || ''}`
            : undefined;
      const isValidRedirect = fromPath && fromPath !== '/login' && fromPath !== '/register';

      if (mode === 'login') {
        const loggedUser = await login({ email: email.trim(), password });
        const targetPath = isValidRedirect ? fromPath : getRoleDefaultPath(loggedUser.roles?.[0]);
        navigate(targetPath, { replace: true });
      } else {
        const registeredUser = await register({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim(),
        });
        setSuccessMessage('Đăng ký tài khoản thành công! Đang chuyển hướng...');
        redirectTimerRef.current = setTimeout(() => {
          const targetPath = isValidRedirect
            ? fromPath
            : getRoleDefaultPath(registeredUser.roles?.[0]);
          navigate(targetPath, { replace: true });
        }, 1000);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('Có lỗi xảy ra trong quá trình xác thực.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs
        variant="segmented"
        tabs={[
          { value: 'login', label: 'Đăng nhập' },
          { value: 'register', label: 'Đăng ký tài khoản' },
        ]}
        value={mode}
        onValueChange={(v) => switchMode(v as AuthMode)}
        className="w-full"
      />

      <div className="grid gap-1.5">
        <Text as="h2" variant="heading" size="lg">
          {mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
        </Text>
        <Text variant="secondary" size="sm">
          {mode === 'login'
            ? 'Đăng nhập để vào không gian làm việc phù hợp với vai trò của bạn.'
            : 'Đăng ký tài khoản khách hàng để bắt đầu tìm kiếm và thuê kho ngay hôm nay.'}
        </Text>
      </div>

      {serverError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-kumo-danger-tint text-kumo-danger text-sm flex items-start gap-2.5"
        >
          <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-kumo-success-tint text-kumo-success text-sm flex items-start gap-2.5"
        >
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {mode === 'register' && (
          <>
            <Input
              id="reg-fullname"
              type="text"
              label="Họ và tên"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={fieldErrors.fullName}
              autoComplete="name"
            />
            <Input
              id="reg-phone"
              type="tel"
              label="Số điện thoại"
              placeholder="0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={fieldErrors.phone}
              autoComplete="tel"
            />
          </>
        )}

        <Input
          id="auth-email"
          type="email"
          label="Email"
          placeholder="customer@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          autoComplete="email"
        />

        <Input
          id="auth-password"
          type="password"
          label="Mật khẩu"
          placeholder={mode === 'login' ? 'Nhập mật khẩu của bạn' : 'Tối thiểu 8 ký tự'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center"
            loading={isSubmitting}
          >
            {mode === 'login' ? 'Đăng nhập vào hệ thống' : 'Tạo tài khoản'}
          </Button>
        </div>
      </form>

      <div className="text-center">
        <Text variant="secondary" size="sm">
          {mode === 'login' ? (
            <>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="font-medium text-kumo-link hover:underline cursor-pointer"
              >
                Đăng ký ngay
              </button>
            </>
          ) : (
            <>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-medium text-kumo-link hover:underline cursor-pointer"
              >
                Đăng nhập tại đây
              </button>
            </>
          )}
        </Text>
      </div>
    </div>
  );
};
