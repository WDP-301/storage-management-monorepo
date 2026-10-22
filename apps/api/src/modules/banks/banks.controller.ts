import { SessionGuard } from '@modules/auth/guards/session.guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { BankLookupThrottle } from './bank-lookup.throttle';
import { BanksService } from './banks.service';
import { VerifyBankAccountDto } from './dto/verify-bank-account.dto';

@ApiTags('Banks')
@Controller('banks')
@UseGuards(SessionGuard)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 503, description: 'SERVICE_UNAVAILABLE', type: ApiErrorResponseDto })
export class BanksController {
  constructor(private readonly banks: BanksService) {}

  @Get()
  @ApiOperation({ summary: 'Banks a refund can be sent to, sorted by short name' })
  list() {
    return this.banks.listBanks();
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @BankLookupThrottle()
  @ApiOperation({
    summary: 'Look a bank account up and return the holder name the bank reports',
  })
  @ApiResponse({ status: 400, description: 'BANK_ACCOUNT_INVALID', type: ApiErrorResponseDto })
  verify(@Body() dto: VerifyBankAccountDto) {
    return this.banks.verifyAccount(dto);
  }
}
