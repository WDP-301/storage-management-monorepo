import { NotificationType } from '@storage/types';
import {
  customerOverdueNotification,
  daysOverdue,
  isCustomerReminderDay,
  isManagerAlertDay,
  managerOverdueAlert,
  type OverdueInvoice,
} from './overdue-reminder.util';

// Due 2027-03-01 at 12:00 Vietnam time.
const DUE_AT = new Date('2027-03-01T05:00:00.000Z');

const invoice: OverdueInvoice = {
  invoiceId: 'inv-1',
  invoiceNo: 'INV-1',
  customerId: 'customer-1',
  customerName: 'Nguyễn Văn A',
  contractId: 'contract-1',
  unitCode: 'A-01',
  facilityId: 'facility-1',
  dueAt: DUE_AT,
  amountDue: 3_000_000,
};

describe('daysOverdue', () => {
  it('is 0 on the due day and 1 the next Vietnam day', () => {
    expect(daysOverdue(DUE_AT, new Date('2027-03-01T16:59:00.000Z'))).toBe(0);
    // 00:00 on 2027-03-02 in Vietnam.
    expect(daysOverdue(DUE_AT, new Date('2027-03-01T17:00:00.000Z'))).toBe(1);
    expect(daysOverdue(DUE_AT, new Date('2027-03-08T01:00:00.000Z'))).toBe(7);
  });
});

describe('reminder schedule', () => {
  const days = Array.from({ length: 30 }, (_, i) => i);

  it('reminds the customer on days 1, 3, 7 and then weekly', () => {
    expect(days.filter(isCustomerReminderDay)).toEqual([1, 3, 7, 14, 21, 28]);
  });

  it('alerts the managers from day 7, weekly', () => {
    expect(days.filter(isManagerAlertDay)).toEqual([7, 14, 21, 28]);
  });
});

describe('overdue notifications', () => {
  it('tells the customer what is owed and what it blocks', () => {
    const payload = customerOverdueNotification(invoice, 3);

    expect(payload.type).toBe(NotificationType.INVOICE_OVERDUE);
    expect(payload.title).toBe('Hóa đơn INV-1 quá hạn 3 ngày');
    expect(payload.body).toContain('(kho A-01)');
    expect(payload.body).toContain('hạn ngày 01/03/2027');
    expect(payload.data).toMatchObject({
      invoiceId: 'inv-1',
      contractId: 'contract-1',
      daysOverdue: 3,
    });
  });

  it('names the customer to the managers', () => {
    const payload = managerOverdueAlert(invoice, 7);

    expect(payload.type).toBe(NotificationType.INVOICE_OVERDUE_ALERT);
    expect(payload.body).toContain('Nguyễn Văn A chưa thanh toán hóa đơn INV-1 (kho A-01)');
    expect(payload.data).toMatchObject({ daysOverdue: 7, customerId: 'customer-1' });
  });
});
