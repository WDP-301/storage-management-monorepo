import { Button, Input, Text } from '@cloudflare/kumo';
import { WarningCircle } from '@phosphor-icons/react';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDefaultPath } from '../../lib/roles';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!email.trim()) {
      errors.email = 'Vui lòng nhập địa chỉ email.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = 'Định dạng email không hợp lệ (ví dụ: user@example.com).';
    }

    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

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
      const isValidRedirect = fromPath && fromPath !== '/login';

      const loggedUser = await login({ email: email.trim(), password });
      const targetPath = isValidRedirect ? fromPath : getRoleDefaultPath(loggedUser.roles?.[0]);
      navigate(targetPath, { replace: true });
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
      <div className="grid gap-1.5">
        <Text as="h2" variant="heading" size="lg">
          Chào mừng trở lại
        </Text>
        <Text variant="secondary" size="sm">
          Đăng nhập để vào không gian làm việc phù hợp với vai trò của bạn.
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          id="auth-email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          autoComplete="email"
        />

        <Input
          id="auth-password"
          type="password"
          label="Mật khẩu"
          placeholder="Nhập mật khẩu của bạn"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          autoComplete="current-password"
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center"
            loading={isSubmitting}
          >
            Đăng nhập vào hệ thống
          </Button>
        </div>
      </form>
    </div>
  );
};
