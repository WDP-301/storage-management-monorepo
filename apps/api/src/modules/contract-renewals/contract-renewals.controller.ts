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
import {
  type ContractRenewalListResponse,
  type ContractRenewalView,
  UserRole,
} from '@storage/types';
import { ContractRenewalQueryService } from './contract-renewal-query.service';
import { ContractRenewalsService } from './contract-renewals.service';
import {
  ApproveContractRenewalDto,
  CreateContractRenewalDto,
  ListContractRenewalsQueryDto,
  RejectContractRenewalDto,
} from './dto/contract-renewal.dto';

const MANAGERS = [UserRole.FACILITY_MANAGER, UserRole.OPERATIONS_MANAGER, UserRole.ADMIN] as const;

@ApiTags('Contract Renewals')
@Controller('contract-renewals')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({ status: 403, description: 'Not allowed', type: ApiErrorResponseDto })
export class ContractRenewalsController {
  constructor(
    private readonly renewals: ContractRenewalsService,
    private readonly queries: ContractRenewalQueryService,
  ) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Ask to extend an active contract by some months at its current price' })
  @ApiResponse({
    status: 409,
    description:
      'Not renewable (ended, past term end, return/unit change open, pending) or INVOICE_OVERDUE',
    type: ApiErrorResponseDto,
  })
  create(
    @Body() dto: CreateContractRenewalDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ContractRenewalView> {
    return this.renewals.create(dto, user);
  }

  @Get('mine')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: "The caller's renewal requests, newest first" })
  listMine(@CurrentUser() user: AuthUser): Promise<ContractRenewalView[]> {
    return this.queries.listMine(user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Withdraw a pending renewal request' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ContractRenewalView> {
    return this.renewals.cancel(id, user);
  }

  @Get()
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Renewal requests, newest first (facility managers: their facilities)' })
  list(
    @Query() query: ListContractRenewalsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ContractRenewalListResponse> {
    return this.queries.list(user, query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Approve: the months are added to the contract term' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveContractRenewalDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ContractRenewalView> {
    return this.renewals.approve(id, dto, user);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Reject with a reason shown to the customer' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectContractRenewalDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ContractRenewalView> {
    return this.renewals.reject(id, dto, user);
  }
}
