import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RawResponse } from '@shared/decorators/raw-response.decorator';
import { SepayWebhookDto } from './dto/sepay-webhook.dto';
import { SepayHmacGuard } from './guards/sepay-hmac.guard';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook/sepay')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SepayHmacGuard)
  @RawResponse()
  @ApiOperation({ summary: 'SePay webhook receiver (HMAC-SHA256 verified)' })
  async receiveWebhook(@Body() dto: SepayWebhookDto): Promise<{ success: boolean }> {
    void this.paymentsService.handleSepayWebhook(dto).catch((err) => {
      this.logger.error(`Error handling sepay webhook id=${dto.id}`, err);
    });

    return { success: true };
  }
}
