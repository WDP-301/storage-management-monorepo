import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoicesService } from './invoices.service';

@Injectable()
export class InvoiceScheduleService {
  private readonly logger = new Logger(InvoiceScheduleService.name);

  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Cron job running every day at midnight (00:00) to scan active contracts
   * and issue recurring rental invoices.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyRecurringInvoicing(): Promise<void> {
    this.logger.log('Starting daily recurring invoice schedule pass...');
    try {
      const result = await this.invoicesService.generateRecurringInvoices();
      this.logger.log(
        `Daily recurring invoice schedule completed: ${result.issuedCount} invoices issued`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed in daily recurring invoice schedule: ${err?.message || err}`,
        err?.stack,
      );
    }
  }
}
