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
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { AccessPassService } from './access-pass.service';
import { CheckInService } from './check-in.service';
import { CheckInHistoryService } from './check-in-history.service';
import { CheckInDto, ListCheckInsQueryDto } from './dto/access.dto';

@ApiTags('Access')
@Controller('access')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
export class AccessController {
  constructor(
    private readonly passes: AccessPassService,
    private readonly checkIns: CheckInService,
    private readonly history: CheckInHistoryService,
  ) {}

  @Post('passes')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({
    summary: 'Issue the caller a short-lived single-use check-in QR',
    description:
      'One code for every warehouse where the caller rents a shelf; the app rotates it before expiry.',
  })
  @ApiResponse({
    status: 409,
    description: 'CHECK_IN_NOT_ALLOWED or INVOICE_OVERDUE',
    type: ApiErrorResponseDto,
  })
  createPass(@CurrentUser() user: AuthUser) {
    return this.passes.createPass(user);
  }

  @Post('check-ins')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.FACILITY_STAFF,
    UserRole.FACILITY_MANAGER,
    UserRole.OPERATIONS_MANAGER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Scan a customer QR at the chosen warehouse and record the entry' })
  @ApiResponse({ status: 404, description: 'Warehouse not found', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'ACCESS_PASS_INVALID, CHECK_IN_NOT_ALLOWED or INVOICE_OVERDUE',
    type: ApiErrorResponseDto,
  })
  checkIn(@Body() dto: CheckInDto, @CurrentUser() user: AuthUser) {
    return this.checkIns.verify(user, dto.qrPayload, dto.warehouseId);
  }

  @Get('check-ins')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({
    summary: 'Check-in history (paginated)',
    description: 'Facility managers only see the facilities they manage.',
  })
  listCheckIns(@Query() query: ListCheckInsQueryDto, @CurrentUser() user: AuthUser) {
    return this.history.list(user, query);
  }
}
