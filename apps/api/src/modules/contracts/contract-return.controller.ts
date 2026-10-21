import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { ContractReturnService } from './contract-return.service';
import { ManagedReturnRequestDto } from './dto/managed-return-request.dto';
import {
  ReturnPreviewQueryDto,
  ReturnRequestDto,
  UpdateReturnRequestDto,
} from './dto/return-request.dto';
import {
  ReturnPreviewResponseDto,
  ReturnRequestCancelledDto,
} from './dto/return-request-response.dto';
import { ManagedReturnService } from './managed-return.service';
import { ReturnPreviewService } from './return-preview.service';

/**
 * Moving out of a unit. The customer owning the contract requests, changes and withdraws the
 * return; someone else's contract is reported as missing (404). Guards are declared here because
 * only throttling is global.
 */
@ApiTags('Contracts')
@Controller('contracts')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
@ApiResponse({ status: 404, type: ApiErrorResponseDto })
export class ContractReturnController {
  constructor(
    private readonly contractReturn: ContractReturnService,
    private readonly managedReturn: ManagedReturnService,
    private readonly returnPreview: ReturnPreviewService,
  ) {}

  @Get(':id/return-preview')
  @ApiOperation({
    summary: 'What returning on a day would cost: notice, early-return deduction, overstay',
    description:
      'Takes the open request into account (moving it earlier restarts the notice). Records nothing.',
  })
  @ApiResponse({ status: 200, type: ReturnPreviewResponseDto })
  @ApiResponse({ status: 400, description: 'Day outside today..+365', type: ApiErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Contract not ACTIVE', type: ApiErrorResponseDto })
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReturnPreviewQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.returnPreview.preview(id, user.id, query.scheduledAt);
  }

  @Post(':id/return-request')
  @ApiOperation({ summary: 'Ask to move out — opens a RETURN inspection on the chosen day' })
  @ApiResponse({ status: 400, description: 'Day outside today..+365', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Contract not ACTIVE or a return is already open',
    type: ApiErrorResponseDto,
  })
  requestReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractReturn.requestReturn(id, user.id, dto);
  }

  @Patch(':id/return-request')
  @ApiOperation({
    summary: 'Change the day, note or refund account of the open return request',
    description: 'Moving the day earlier restarts the notice from now; later keeps it.',
  })
  @ApiResponse({ status: 400, description: 'Day outside today..+365', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Return already finalized or contract not ACTIVE',
    type: ApiErrorResponseDto,
  })
  updateReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReturnRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractReturn.updateReturn(id, user.id, dto);
  }

  // 200 with a body, not 204: the mobile client treats an empty response as a failure.
  @Delete(':id/return-request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw the open return request while staff recorded nothing' })
  @ApiResponse({ status: 200, type: ReturnRequestCancelledDto })
  @ApiResponse({
    status: 409,
    description: 'RETURN_REQUEST_LOCKED once staff recorded photos, damages or notes',
    type: ApiErrorResponseDto,
  })
  cancelReturn(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.contractReturn.cancelReturn(id, user.id);
  }

  @Post(':id/return-request/on-behalf')
  @Roles(UserRole.FACILITY_MANAGER, UserRole.OPERATIONS_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Open a return request for the customer (phoned the branch, or abandoned the unit)',
    description: 'Facility managers only for units of the facilities they manage.',
  })
  @ApiResponse({ status: 400, description: 'Day outside today..+365', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Contract not ACTIVE or a return is already open',
    type: ApiErrorResponseDto,
  })
  requestOnBehalf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManagedReturnRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.managedReturn.requestOnBehalf(id, user, dto);
  }
}
