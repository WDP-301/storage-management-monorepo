import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves business rules that were fixed in code into `system_settings`, each seeded with the value
 * the code used, so nothing behaves differently until an admin changes it:
 * - billing: overdue reminder days, repeat interval, manager alert threshold, fee invoice due
 *   days, rent grace days and the VAT rate on rent invoices;
 * - contract: unit-change top-up due days, auto-cancel of an overdue move, the contract creation
 *   window after booking, how far ahead a return may be booked, and the share of the deposit an
 *   early return forfeits;
 * - shelf: counter session length and how far ahead a drop-off or pick-up may be requested;
 * - staff: how early a shift check-in opens.
 */
export class ConfigurableBusinessRules1792170000000 implements MigrationInterface {
  name = 'ConfigurableBusinessRules1792170000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "system_settings"
        ("key", "value", "value_type", "group", "description", "label", "default_value", "min", "max")
      VALUES
        ('billing.overdue_reminder_days', '[1,3,7]', 'int_list', 'billing', 'Days overdue on which the customer is reminded of an unpaid invoice.', 'Overdue reminder days', '[1,3,7]', 1, 90),
        ('billing.overdue_reminder_repeat_days', '7', 'int', 'billing', 'After the last reminder day (customer) or the manager alert day, reminders repeat every this many days.', 'Overdue reminder repeat (days)', '7', 1, 30),
        ('billing.overdue_manager_alert_from_days', '7', 'int', 'billing', 'Days overdue from which the branch managers are alerted as well.', 'Manager overdue alert from (days)', '7', 1, 90),
        ('billing.fee_invoice_due_days', '7', 'int', 'billing', 'Days a customer has to pay a fee invoice (damage, deposit shortfall, old unit rent).', 'Fee invoice due (days)', '7', 0, 60),
        ('billing.rent_grace_days', '0', 'int', 'billing', 'Days after a rent period starts before its invoice counts as overdue.', 'Rent grace period (days)', '0', 0, 30),
        ('billing.vat_tax_rate_percent', '0', 'float', 'billing', 'VAT added on top of rent invoices issued from now on. Deposits and fee invoices carry no VAT.', 'VAT on rent (%)', '0', 0, 20),
        ('contract.unit_change_top_up_due_days', '7', 'int', 'contract', 'A unit-change deposit top-up is due on the move day, but never later than this many days after approval.', 'Unit change top-up due (days)', '7', 1, 30),
        ('contract.unit_change_move_overdue_days', '7', 'int', 'contract', 'Days after the booked move day before a unit change still waiting for its deposit top-up is cancelled automatically.', 'Unit change move overdue (days)', '7', 1, 60),
        ('contract.creation_window_days', '7', 'int', 'contract', 'Days after a booking is made during which its contract can be created.', 'Contract creation window (days)', '7', 1, 60),
        ('contract.return_max_days_ahead', '365', 'int', 'contract', 'Furthest day ahead a return can be booked or rescheduled.', 'Return booking horizon (days)', '365', 30, 730),
        ('contract.early_return_forfeit_percent', '100', 'float', 'contract', 'Share of the deposit kept when a unit is returned before the last day of the term. Applies to return requests made from now on.', 'Early return deposit forfeit (%)', '100', 0, 100),
        ('shelf.counter_session_minutes', '30', 'int', 'shelf', 'How long a scanned pass keeps the shelf counter session open.', 'Counter session (minutes)', '30', 5, 240),
        ('shelf.request_max_days_ahead', '30', 'int', 'shelf', 'Furthest day ahead a shelf drop-off or pick-up may be requested.', 'Shelf request horizon (days)', '30', 1, 180),
        ('staff.check_in_opens_before_minutes', '30', 'int', 'staff', 'How many minutes before a shift starts its check-in opens.', 'Shift check-in opens before (minutes)', '30', 0, 180)
      ON CONFLICT ("key") DO NOTHING`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "system_settings" WHERE "key" IN (
        'billing.overdue_reminder_days', 'billing.overdue_reminder_repeat_days',
        'billing.overdue_manager_alert_from_days', 'billing.fee_invoice_due_days',
        'billing.rent_grace_days', 'billing.vat_tax_rate_percent',
        'contract.unit_change_top_up_due_days', 'contract.unit_change_move_overdue_days',
        'contract.creation_window_days', 'contract.return_max_days_ahead',
        'contract.early_return_forfeit_percent', 'shelf.counter_session_minutes',
        'shelf.request_max_days_ahead', 'staff.check_in_opens_before_minutes')`,
    );
  }
}
