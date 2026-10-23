import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { ContractInvoicesService } from './contract-invoices.service';
import { RecordInvoicePaymentDto } from './dto/record-invoice-payment.dto';

/**
 * Back-office view of a contract's invoices and manual payment recording. Facility managers are
 * limited to contracts of their facilities by the service.
 */
@ApiTags('Contracts')
@Controller('contracts')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
@ApiResponse({ status: 404, type: ApiErrorResponseDto })
export class ContractInvoicesController {
  constructor(private readonly invoices: ContractInvoicesService) {}

  @Get(':id/invoices')
  @ApiOperation({ summary: 'Invoices of a contract with their payments and amount still due' })
  @ApiResponse({ status: 200, description: 'ContractInvoiceRecord[]' })
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.list(id, user);
  }

  @Post(':id/invoices/:invoiceId/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record a payment SePay could not match (cash, or a transfer with wrong content)',
    description:
      'Settles the invoice (PAID or PARTIALLY_PAID). A bank transfer needs its reference or ' +
      'evidence files; the amount may not exceed what is still due.',
  })
  @ApiResponse({ status: 200, description: 'The updated ContractInvoiceRecord' })
  @ApiResponse({
    status: 400,
    description: 'Amount above the amount due, missing transfer proof, or a future date',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Invoice no longer payable, or the transfer reference was already recorded',
    type: ApiErrorResponseDto,
  })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: RecordInvoicePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.recordPayment(id, invoiceId, dto, user);
  }
}
