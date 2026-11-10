import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import {
  AssignSepayTransferDto,
  ListSepayTransfersQueryDto,
  ResolveSepayTransferDto,
} from './dto/sepay-transfer.dto';
import { SepayTransfersService } from './sepay-transfers.service';

@ApiTags('Payments')
@Controller('payments/sepay-transfers')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
export class SepayTransfersController {
  constructor(private readonly transfers: SepayTransfersService) {}

  @Get()
  @ApiOperation({
    summary: 'Reconciliation queue: inbound bank transfers the matcher could not place',
    description:
      'Lists transfers by outcome — default only the queue needing attention ' +
      '(RECEIVED, UNMATCHED, AMBIGUOUS, LATE, NEEDS_REVIEW); attention=false lists all.',
  })
  async list(@Query() query: ListSepayTransfersQueryDto) {
    return this.transfers.list(query);
  }

  @Post(':id/assign')
  @ApiOperation({
    summary: 'Assign a queued transfer to a booking, replaying the deposit-confirmation path',
    description:
      'The booking must still await its deposit. A confirmed assignment covers the deposit and ' +
      'creates the contracts exactly as an automatic match would have.',
  })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSepayTransferDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.transfers.assign(id, dto, actor);
  }

  @Post(':id/resolve')
  @ApiOperation({
    summary: 'Close a queued transfer with a written explanation of how it was handled',
  })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto })
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveSepayTransferDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.transfers.resolve(id, dto.note, actor);
  }
}
