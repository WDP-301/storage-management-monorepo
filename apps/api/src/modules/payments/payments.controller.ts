import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RawResponse } from '@shared/decorators/raw-response.decorator';
import { SepayWebhookDto } from './dto/sepay-webhook.dto';
import { SepayHmacGuard } from './guards/sepay-hmac.guard';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook/sepay')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SepayHmacGuard)
  @RawResponse()
  @ApiOperation({ summary: 'SePay webhook receiver (HMAC-SHA256 verified)' })
  async receiveWebhook(@Body() dto: SepayWebhookDto): Promise<{ success: boolean }> {
    await this.paymentsService.handleSepayWebhook(dto);
    return { success: true };
  }
}
