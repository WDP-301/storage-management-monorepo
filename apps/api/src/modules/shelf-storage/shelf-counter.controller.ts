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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { CounterSessionsService } from './counter-sessions.service';
import { OpenCounterSessionDto } from './dto/counter-session.dto';
import { ShelfReceiptSearchQueryDto } from './dto/shelf-list-query.dto';
import { CreateShelfReceiptDto, VoidShelfReceiptDto } from './dto/shelf-receipt.dto';
import { CreateShelfRecoveryDto } from './dto/shelf-recovery.dto';
import { ReceiptVoidService } from './receipt-void.service';
import { ShelfReceiptsService } from './shelf-receipts.service';
import { ShelfRecoveryService } from './shelf-recovery.service';
import { ShelfStorageReadsService } from './shelf-storage-reads.service';

const STAFF = [
  UserRole.FACILITY_STAFF,
  UserRole.FACILITY_MANAGER,
  UserRole.OPERATIONS_MANAGER,
  UserRole.ADMIN,
] as const;
const MANAGERS = [UserRole.FACILITY_MANAGER, UserRole.OPERATIONS_MANAGER, UserRole.ADMIN] as const;

/** What staff do at the counter of a shelf warehouse. */
@ApiTags('Shelf storage')
@Controller('shelf-storage')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
export class ShelfCounterController {
  constructor(
    private readonly sessions: CounterSessionsService,
    private readonly receipts: ShelfReceiptsService,
    private readonly voids: ReceiptVoidService,
    private readonly recovery: ShelfRecoveryService,
    private readonly reads: ShelfStorageReadsService,
  ) {}

  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  @Roles(...STAFF)
  @ApiOperation({
    summary: 'Scan a customer QR at the chosen warehouse and open a 30-minute counter session',
    description:
      'Consumes the pass. Returns the customer, their ACTIVE shelf contracts here, stock, the open pick-up request and why a drop-off or pick-up would be refused. Scanning a pass this staff member already consumed here, while its session is live, returns the same session.',
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description:
      'ACCESS_PASS_INVALID (MALFORMED, NOT_FOUND, USED, EXPIRED) or CHECK_IN_NOT_ALLOWED (NO_SHELF_CONTRACT)',
    type: ApiErrorResponseDto,
  })
  openSession(@Body() dto: OpenCounterSessionDto, @CurrentUser() user: AuthUser) {
    return this.sessions.open(user, dto.qrPayload, dto.warehouseId);
  }

  @Get('sessions/:id')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Fresh panel of a live counter session (only its scanner)' })
  @ApiResponse({
    status: 409,
    description: 'COUNTER_SESSION_INVALID (NOT_FOUND, EXPIRED)',
    type: ApiErrorResponseDto,
  })
  getSession(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.get(user, id);
  }

  @Post('receipts')
  @Roles(...STAFF)
  @ApiOperation({
    summary: 'Record a drop-off or pick-up; stock changes now and the customer is notified',
    description:
      'Replay-safe through clientRequestId. A drop-off needs at least one photo and may add new items by name. An overdue invoice blocks both types, except a pick-up on a contract with an open return.',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description:
      'COUNTER_SESSION_INVALID, SHELF_RECEIPT_NOT_ALLOWED, SHELF_STOCK_INSUFFICIENT or INVOICE_OVERDUE',
    type: ApiErrorResponseDto,
  })
  createReceipt(@Body() dto: CreateShelfReceiptDto, @CurrentUser() user: AuthUser) {
    return this.receipts.create(user, dto);
  }

  @Post('receipts/:id/void')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGERS)
  @ApiOperation({
    summary: 'Void a receipt with a reason and reverse its stock',
    description: 'Facility managers only void receipts of the facilities they manage.',
  })
  @ApiResponse({
    status: 409,
    description:
      'CONFLICT (ALREADY_VOIDED), SHELF_RECEIPT_NOT_ALLOWED (CONTRACT_NOT_ACTIVE) or SHELF_STOCK_INSUFFICIENT (VOID)',
    type: ApiErrorResponseDto,
  })
  voidReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidShelfReceiptDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.voids.void(user, id, dto.reason);
  }

  @Get('warehouses/:id/receipts')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Receipts of a warehouse, newest first' })
  listWarehouseReceipts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ShelfReceiptSearchQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reads.listWarehouseReceipts(user, id, query);
  }

  @Get('warehouses/:id/stock')
  @Roles(...STAFF)
  @ApiOperation({
    summary: 'Stock of a warehouse: one row per active shelf contract, shelf code ascending',
    description: 'Empty shelves are included. 404 for a warehouse that is not a shelf warehouse.',
  })
  listWarehouseStock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.reads.listWarehouseStock(user, id);
  }

  @Get('warehouses/:id/abandoned-contracts')
  @Roles(...MANAGERS)
  @ApiOperation({
    summary: 'Contracts with an open ABANDONED return and goods still on the shelf',
  })
  listAbandoned(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.recovery.list(user, id);
  }

  @Post('recoveries')
  @Roles(...MANAGERS)
  @ApiOperation({
    summary: 'Recover goods from an abandoned shelf without a scan (pick-up receipt)',
    description:
      'Only on a contract with an open ABANDONED return; photo and note required; never blocked by debt. Replay-safe through clientRequestId.',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'SHELF_RECEIPT_NOT_ALLOWED (NOT_ABANDONED_RETURN, …) or SHELF_STOCK_INSUFFICIENT',
    type: ApiErrorResponseDto,
  })
  createRecovery(@Body() dto: CreateShelfRecoveryDto, @CurrentUser() user: AuthUser) {
    return this.recovery.create(user, dto);
  }
}
