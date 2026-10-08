import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadsApi } from '../lib/api';
import { SignedFileLink, safeHttpUrl } from './SignedFile';

describe('SignedFile', () => {
  afterEach(() => vi.restoreAllMocks());

  it('only lets http(s) legacy URLs through', () => {
    expect(safeHttpUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });

  it('renders an unsafe legacy link as plain text', () => {
    render(<SignedFileLink file={{ name: 'evil', url: 'javascript:alert(1)' }} />);
    expect(screen.queryByRole('button', { name: 'evil' })).toBeNull();
    expect(screen.getByText('evil')).toBeTruthy();
  });

  it('opens a private file through a fresh presigned URL', async () => {
    const tab = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    vi.spyOn(UploadsApi, 'downloadUrl').mockResolvedValue('https://signed.example/x.jpg');

    render(<SignedFileLink file={{ name: 'x.jpg', fileKey: 'uploads/x.jpg' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'x.jpg' }));

    await waitFor(() => expect(tab.location.href).toBe('https://signed.example/x.jpg'));
    expect(UploadsApi.downloadUrl).toHaveBeenCalledWith('uploads/x.jpg');
  });
});
