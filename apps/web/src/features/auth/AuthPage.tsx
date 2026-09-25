import { AlertCircle, CheckCircle2, Lock, Mail, Phone, User } from 'lucide-react';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../design-system/Button';
import { FieldError, Input, Label, TextField } from '../../design-system/Input';
import { Tabs } from '../../design-system/Tabs';

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

  // Redirection target after login
  const fromLocation =
    (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

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
      if (mode === 'login') {
        await login({ email: email.trim(), password });
        navigate(fromLocation, { replace: true });
      } else {
        await register({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim(),
        });
        setSuccessMessage('Đăng ký tài khoản thành công! Đang chuyển hướng...');
        redirectTimerRef.current = setTimeout(() => {
          navigate(fromLocation, { replace: true });
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
    <div>
      {/* Tab Switcher */}
      <div className="flex justify-center mb-6">
        <Tabs
          tabs={[
            { id: 'login', label: 'Đăng nhập' },
            { id: 'register', label: 'Đăng ký tài khoản' },
          ]}
          activeTab={mode}
          onChange={(tabId) => switchMode(tabId as AuthMode)}
        />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
        </h2>
        <p className="text-xs text-muted mt-1">
          {mode === 'login'
            ? 'Đăng nhập để xem danh sách kho, giữ chỗ và quản lý đơn đặt của bạn.'
            : 'Đăng ký tài khoản khách hàng để bắt đầu tìm kiếm và thuê kho ngay hôm nay.'}
        </p>
      </div>

      {/* Server Error Alert */}
      {serverError && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-lg border border-danger/25 bg-danger/10 text-danger text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{serverError}</div>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-lg border border-success/30 bg-success/10 text-success text-xs flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {mode === 'register' && (
          <>
            <TextField isInvalid={!!fieldErrors.fullName} isRequired>
              <Label isRequired htmlFor="reg-fullname">
                Họ và tên
              </Label>
              <Input
                id="reg-fullname"
                type="text"
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                isInvalid={!!fieldErrors.fullName}
                leftIcon={<User className="w-4 h-4" />}
                autoComplete="name"
              />
              <FieldError>{fieldErrors.fullName}</FieldError>
            </TextField>

            <TextField isInvalid={!!fieldErrors.phone} isRequired>
              <Label isRequired htmlFor="reg-phone">
                Số điện thoại
              </Label>
              <Input
                id="reg-phone"
                type="tel"
                placeholder="0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                isInvalid={!!fieldErrors.phone}
                leftIcon={<Phone className="w-4 h-4" />}
                autoComplete="tel"
              />
              <FieldError>{fieldErrors.phone}</FieldError>
            </TextField>
          </>
        )}

        <TextField isInvalid={!!fieldErrors.email} isRequired>
          <Label isRequired htmlFor="auth-email">
            Email
          </Label>
          <Input
            id="auth-email"
            type="email"
            placeholder="customer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            isInvalid={!!fieldErrors.email}
            leftIcon={<Mail className="w-4 h-4" />}
            autoComplete="email"
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </TextField>

        <TextField isInvalid={!!fieldErrors.password} isRequired>
          <div className="flex items-center justify-between">
            <Label isRequired htmlFor="auth-password">
              Mật khẩu
            </Label>
            {mode === 'login' && (
              <span className="text-[11px] text-muted cursor-not-allowed">Quên mật khẩu?</span>
            )}
          </div>
          <Input
            id="auth-password"
            type="password"
            placeholder={mode === 'login' ? 'Nhập mật khẩu của bạn' : 'Tối thiểu 8 ký tự'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            isInvalid={!!fieldErrors.password}
            leftIcon={<Lock className="w-4 h-4" />}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <FieldError>{fieldErrors.password}</FieldError>
        </TextField>

        <div className="pt-2">
          <Button type="submit" variant="primary" size="md" fullWidth isLoading={isSubmitting}>
            {mode === 'login' ? 'Đăng nhập vào hệ thống' : 'Tạo tài khoản'}
          </Button>
        </div>
      </form>

      <div className="mt-6 text-center text-xs text-muted">
        {mode === 'login' ? (
          <>
            Chưa có tài khoản?{' '}
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="font-semibold text-accent hover:underline cursor-pointer"
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
              className="font-semibold text-accent hover:underline cursor-pointer"
            >
              Đăng nhập tại đây
            </button>
          </>
        )}
      </div>
    </div>
  );
};
