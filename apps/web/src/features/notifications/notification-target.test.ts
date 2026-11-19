import { describe, expect, it } from 'vitest';
import { formatNotificationTime, notificationTarget } from './notification-target';

describe('notificationTarget', () => {
  it('sends refund work to the reconciliation queue', () => {
    expect(notificationTarget('BOOKING_NEEDS_REFUND', {})).toBe('/admin/sepay-transfers');
  });

  it('opens the contract list filtered to the contract and its settlement state', () => {
    expect(notificationTarget('SETTLEMENT_PENDING_APPROVAL', { contractNo: 'CT 1' })).toBe(
      '/contracts?search=CT%201&settlement=pending',
    );
    expect(notificationTarget('CONTRACT_REFUND_PENDING', { contractNo: 'CT-2' })).toBe(
      '/contracts?search=CT-2&settlement=awaiting_refund',
    );
    expect(notificationTarget('INVOICE_OVERDUE_ALERT', { contractNo: 'CT-3' })).toBe(
      '/contracts?search=CT-3',
    );
    expect(notificationTarget('CONTRACT_OVERDUE', {})).toBe('/contracts');
  });

  it('routes renewals, tickets, tours and unit changes to their pages', () => {
    expect(notificationTarget('CONTRACT_RENEWAL_REQUESTED', {})).toBe('/contract-renewals');
    expect(notificationTarget('TICKET_ASSIGNED', {})).toBe('/facility-manager/tickets');
    expect(notificationTarget('TOUR_APPOINTMENT_CREATED', {})).toBe(
      '/facility-manager/tour-appointments',
    );
    expect(notificationTarget('UNIT_CHANGE_MOVE_TODAY', {})).toBe('/facility-manager');
  });

  it('leads nowhere for a type the web has no page for', () => {
    expect(notificationTarget('SHIFT_ASSIGNED', {})).toBeNull();
  });
});

describe('formatNotificationTime', () => {
  const now = Date.parse('2026-11-19T10:00:00.000Z');

  it('counts minutes, hours and days back', () => {
    expect(formatNotificationTime('2026-11-19T09:59:30.000Z', now)).toBe('Vừa xong');
    expect(formatNotificationTime('2026-11-19T09:15:00.000Z', now)).toBe('45 phút trước');
    expect(formatNotificationTime('2026-11-19T05:00:00.000Z', now)).toBe('5 giờ trước');
    expect(formatNotificationTime('2026-11-16T10:00:00.000Z', now)).toBe('3 ngày trước');
  });

  it('is empty for an invalid timestamp', () => {
    expect(formatNotificationTime('nope', now)).toBe('');
  });
});
