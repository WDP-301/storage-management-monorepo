import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { InvoiceStatus, UserRole } from '@storage/types';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(SessionGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('my')
  @ApiOperation({ summary: 'Get invoices belonging to the current customer' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'contractId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of customer invoices' })
  getMyInvoices(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: InvoiceStatus,
    @Query('contractId', new ParseUUIDPipe({ optional: true })) contractId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.getMyInvoices(user.id, {
      status,
      contractId,
      page: page ? Number.parseInt(page, 10) : 1,
      limit: limit ? Number.parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice details by ID with VietQR for payment' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  @ApiResponse({ status: 404, description: 'Invoice not found', type: ApiErrorResponseDto })
  getInvoiceById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.invoicesService.getInvoiceById(id, user);
  }

  @Post('trigger-schedule')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger recurring invoice scan (Admin only)' })
  @ApiResponse({ status: 200, description: 'Recurring invoice generation result' })
  triggerRecurringScan() {
    return this.invoicesService.generateRecurringInvoices();
  }

  @Post(':id/regenerate-pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.FACILITY_MANAGER,
    UserRole.FACILITY_STAFF,
  )
  @ApiOperation({ summary: 'Trigger background regeneration of invoice PDF' })
  @ApiResponse({ status: 202, description: 'Job enqueued' })
  regeneratePdf(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.invoicesService.queuePdfRegeneration(id, user);
  }
}
