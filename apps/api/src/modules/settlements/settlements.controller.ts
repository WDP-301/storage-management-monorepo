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
import { ApproveSettlementDto } from './dto/approve-settlement.dto';
import { CompleteRefundDto } from './dto/complete-refund.dto';
import { SettlementDecisionsDto } from './dto/settlement-decisions.dto';
import { SettlementApproveService } from './settlement-approve.service';
import { SettlementQueryService } from './settlement-query.service';
import { SettlementRefundService } from './settlement-refund.service';

/**
 * Deposit settlement of ended contracts, for operations and admins only. Guards are declared
 * here because only throttling is global. Responses are `SettlementDetailRecord`.
 */
@ApiTags('Settlements')
@Controller('settlements')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
@ApiResponse({ status: 404, type: ApiErrorResponseDto })
export class SettlementsController {
  constructor(
    private readonly query: SettlementQueryService,
    private readonly approval: SettlementApproveService,
    private readonly refund: SettlementRefundService,
  ) {}

  @Get('contracts/:contractId')
  @ApiOperation({
    summary: 'Settlement of an ended contract: live preview until approved, then frozen',
  })
  @ApiResponse({ status: 200, description: 'SettlementDetailRecord' })
  @ApiResponse({
    status: 409,
    description: 'SETTLEMENT_NOT_READY: contract not ENDED',
    type: ApiErrorResponseDto,
  })
  detail(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.query.detail(contractId);
  }

  @Post('contracts/:contractId/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Figures and version for these decisions; records nothing' })
  @ApiResponse({ status: 200, description: 'SettlementDetailRecord with `version`' })
  @ApiResponse({
    status: 400,
    description: 'Decision about a missing line',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'SETTLEMENT_NOT_READY or SETTLEMENT_ALREADY_APPROVED',
    type: ApiErrorResponseDto,
  })
  preview(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: SettlementDecisionsDto,
  ) {
    return this.query.preview(contractId, dto);
  }

  @Post('contracts/:contractId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve: offset debts from the deposit, bill the shortfall, await the refund',
  })
  @ApiResponse({ status: 200, description: 'The frozen SettlementDetailRecord' })
  @ApiResponse({
    status: 400,
    description: 'Invalid decision, or bankOverrideReason missing',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'SETTLEMENT_NOT_READY, SETTLEMENT_ALREADY_APPROVED, DEPOSIT_MISSING, DECISION_REQUIRED, SETTLEMENT_CHANGED or REFUND_ACCOUNT_REQUIRED',
    type: ApiErrorResponseDto,
  })
  approve(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: ApproveSettlementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approval.approve(contractId, dto, user);
  }

  @Post('contracts/:contractId/refund-complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark the manual refund transfer done (transfer ref or evidence)' })
  @ApiResponse({ status: 200, description: 'The completed SettlementDetailRecord' })
  @ApiResponse({
    status: 400,
    description: 'Neither evidence nor transferRef',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'REFUND_NOT_PENDING, or the transfer reference was already used',
    type: ApiErrorResponseDto,
  })
  completeRefund(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: CompleteRefundDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.refund.complete(contractId, dto, user);
  }
}
