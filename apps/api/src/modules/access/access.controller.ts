import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { AccessPassService } from './access-pass.service';
import { CheckInHistoryService } from './check-in-history.service';
import { ListCheckInsQueryDto } from './dto/access.dto';

@ApiTags('Access')
@Controller('access')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
export class AccessController {
  constructor(
    private readonly passes: AccessPassService,
    private readonly history: CheckInHistoryService,
  ) {}

  @Post('passes')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({
    summary: 'Issue the caller a short-lived single-use drop-off / pick-up code',
    description:
      'One code for every warehouse where the caller rents a shelf; staff scan it at the counter and the app rotates it before expiry.',
  })
  @ApiResponse({
    status: 409,
    description: 'CHECK_IN_NOT_ALLOWED or INVOICE_OVERDUE',
    type: ApiErrorResponseDto,
  })
  createPass(@CurrentUser() user: AuthUser) {
    return this.passes.createPass(user);
  }

  @Get('check-ins')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({
    summary: 'Counter scan log (paginated)',
    description:
      'Used passes, newest first; also lists legacy entries. Facility managers only see the facilities they manage.',
  })
  listCheckIns(@Query() query: ListCheckInsQueryDto, @CurrentUser() user: AuthUser) {
    return this.history.list(user, query);
  }
}
