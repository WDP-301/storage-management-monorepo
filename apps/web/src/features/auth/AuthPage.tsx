import { Button, Input, InputGroup, Text } from '@cloudflare/kumo';
import { Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDefaultPath } from '../../lib/roles';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

interface ApiError {
  status?: number;
  statusCode?: number;
  code?: string;
  message?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
      const apiErr = err as ApiError;
      const is401 = apiErr.status === 401 || apiErr.statusCode === 401;
      const isInvalidCreds =
        apiErr.code === 'INVALID_CREDENTIALS' ||
        apiErr.message?.toLowerCase().includes('invalid email or password');

      if (is401 || isInvalidCreds) {
        setServerError('Email hoặc mật khẩu không chính xác.');
      } else {
        setServerError(apiErr.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-1.5 text-center">
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
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            if (serverError) setServerError(null);
          }}
          error={fieldErrors.email}
          autoComplete="email"
        />

        <InputGroup
          id="auth-password"
          label="Mật khẩu"
          error={fieldErrors.password ? { message: fieldErrors.password, match: true } : undefined}
          size="base"
        >
          <InputGroup.Input
            id="auth-password"
            aria-label="Mật khẩu"
            type={showPassword ? 'text' : 'password'}
            placeholder="Nhập mật khẩu của bạn"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password)
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              if (serverError) setServerError(null);
            }}
            autoComplete="current-password"
          />
          <InputGroup.Addon align="end">
            <InputGroup.Button
              type="button"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              icon={showPassword ? EyeSlash : Eye}
              onClick={() => setShowPassword((prev) => !prev)}
            />
          </InputGroup.Addon>
        </InputGroup>

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
