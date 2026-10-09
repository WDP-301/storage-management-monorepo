import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContextType } from '../../types/auth';
import { AuthPage } from './AuthPage';

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockRefreshUser = vi.fn();

const defaultAuthContext: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: mockLogin,
  logout: mockLogout,
  refreshUser: mockRefreshUser,
};

// Mock useAuth
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => defaultAuthContext,
}));

describe('AuthPage Form Validation and Interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (initialPath = '/login') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('validates empty email and password on login submit', async () => {
    renderComponent('/login');

    const submitBtn = screen.getByRole('button', { name: /đăng nhập vào hệ thống/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Vui lòng nhập địa chỉ email.')).toBeTruthy();
    expect(await screen.findByText('Vui lòng nhập mật khẩu.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates invalid email format', async () => {
    renderComponent('/login');

    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });

    const submitBtn = screen.getByRole('button', { name: /đăng nhập vào hệ thống/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Định dạng email không hợp lệ (ví dụ: user@example.com).'),
    ).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login when valid credentials are submitted', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'usr-1',
      email: 'test@example.com',
      fullName: 'Test User',
      status: 'ACTIVE',
      roles: ['CUSTOMER'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderComponent('/login');

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByPlaceholderText('Nhập mật khẩu của bạn');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitBtn = screen.getByRole('button', { name: /đăng nhập vào hệ thống/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('displays server error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Email hoặc mật khẩu không chính xác.'));

    renderComponent('/login');

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByPlaceholderText('Nhập mật khẩu của bạn');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    const submitBtn = screen.getByRole('button', { name: /đăng nhập vào hệ thống/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Email hoặc mật khẩu không chính xác.')).toBeTruthy();
  });

  it('redirects to location.state.from after successful login when provided', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'usr-ops',
      email: 'ops@example.com',
      fullName: 'Ops Manager',
      status: 'ACTIVE',
      roles: ['OPERATIONS_MANAGER'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: { from: { pathname: '/operations', search: '?filter=urgent' } },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/operations" element={<div>Operations Target Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByPlaceholderText('Nhập mật khẩu của bạn');

    fireEvent.change(emailInput, { target: { value: 'ops@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitBtn = screen.getByRole('button', { name: /đăng nhập vào hệ thống/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Operations Target Screen')).toBeTruthy();
  });
});
