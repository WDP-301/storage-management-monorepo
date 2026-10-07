import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AuthApi } from './lib/api';

vi.mock('./lib/api', () => ({
  AuthApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
  FacilitiesApi: {
    mine: vi.fn().mockResolvedValue([]),
  },
  setUnauthorizedCallback: vi.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login page when user is not authenticated', async () => {
    vi.mocked(AuthApi.me).mockRejectedValue(new Error('Unauthorized'));
    window.history.pushState({}, 'Login', '/login');

    render(<App />);

    expect(await screen.findByText('Chào mừng trở lại')).toBeTruthy();
    expect(screen.getByRole('button', { name: /đăng nhập vào hệ thống/i })).toBeTruthy();
  });

  it('renders app shell with dashboard when user is authenticated', async () => {
    vi.mocked(AuthApi.me).mockResolvedValue({
      id: 'usr-1',
      email: 'admin@example.com',
      fullName: 'Quản trị viên',
      status: 'ACTIVE',
      roles: ['ADMIN'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    window.history.pushState({}, 'Home', '/');

    render(<App />);

    expect((await screen.findAllByText('Storage Hub')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Quản trị viên')).length).toBeGreaterThan(0);
  });
});
