import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { CustomerService } from './customer.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import type { ChangePasswordResponse, CustomerProfileResponse } from './types/customer-profile';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(SessionGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Patch(':id/profile')
  @ApiOperation({ summary: 'Update a customer profile (self or admin)' })
  @ApiResponse({ status: 200, description: 'The updated profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Not the profile owner and not an admin',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiErrorResponseDto })
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerProfileDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomerProfileResponse> {
    return this.customerService.updateProfile(id, dto, user);
  }

  @Patch('me/password')
  @ApiOperation({
    summary: 'Change the authenticated customer password',
    description:
      'Changes the password of the currently authenticated customer (identity from session)',
  })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiErrorResponseDto })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    return this.customerService.changePassword(user, dto);
  }
}
