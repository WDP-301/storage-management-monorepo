import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { ShelfPageQueryDto } from './dto/shelf-list-query.dto';
import { ShelfStorageReadsService } from './shelf-storage-reads.service';

/** Stock and receipts as the customer and the staff of its facility read them. */
@ApiTags('Shelf storage')
@Controller('shelf-storage')
@UseGuards(SessionGuard, RolesGuard)
@Roles(
  UserRole.CUSTOMER,
  UserRole.FACILITY_STAFF,
  UserRole.FACILITY_MANAGER,
  UserRole.OPERATIONS_MANAGER,
  UserRole.ADMIN,
)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
@ApiResponse({
  status: 404,
  description: 'Unknown, or not the caller own',
  type: ApiErrorResponseDto,
})
export class ShelfRecordsController {
  constructor(private readonly reads: ShelfStorageReadsService) {}

  @Get('receipts/:id')
  @ApiOperation({ summary: 'One receipt with lines and photos' })
  getReceipt(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.reads.getReceipt(user, id);
  }

  @Get('contracts/:id')
  @ApiOperation({
    summary:
      'Items stored on the contract shelf, the open pick-up request and whether one can be made',
  })
  getContract(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.reads.getContract(user, id);
  }

  @Get('contracts/:id/receipts')
  @ApiOperation({ summary: 'Receipt history of a contract, newest first, voided ones included' })
  listContractReceipts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ShelfPageQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reads.listContractReceipts(user, id, query);
  }
}
