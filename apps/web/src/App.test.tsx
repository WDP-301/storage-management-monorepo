import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the StorageHub dashboard header and facility views', async () => {
    render(<App />);
    expect((await screen.findAllByText('StorageHub')).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('Dashboard Vận hành Cơ sở')).toBeTruthy();
    const facilityElements = await screen.findAllByText('StorageHub Sala Mega Center');
    expect(facilityElements.length).toBeGreaterThanOrEqual(1);
  });
});
