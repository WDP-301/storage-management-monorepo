import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./lib/api', () => ({
  StorageApi: {
    getDashboardSummary: vi.fn().mockResolvedValue({}),
    getItems: vi.fn().mockResolvedValue({ data: [] }),
    getLocations: vi.fn().mockResolvedValue([]),
    uploadFileDirect: vi.fn(),
    getPresignedUploadUrl: vi.fn(),
    getDownloadUrl: vi.fn(),
  },
}));

describe('App', () => {
  it('renders the dashboard header', async () => {
    render(<App />);
    expect(await screen.findByText('Storage Management Hub')).toBeTruthy();
  });
});
