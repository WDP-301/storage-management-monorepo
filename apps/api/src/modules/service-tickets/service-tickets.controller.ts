import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { SessionGuard } from '@modules/auth/guards/session.guard';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import type { Response } from 'express';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { TicketIdParamDto } from './dto/ticket-params.dto';
import {
  ServiceTicketDeleteResponseDto,
  ServiceTicketListResponseDto,
  ServiceTicketResponseDto,
} from './dto/ticket-response.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ServiceTicketsService } from './service-tickets.service';
import type {
  ServiceTicketDeleteResponse,
  ServiceTicketListResponse,
  ServiceTicketResponse,
} from './types/service-ticket';

@ApiTags('Service Tickets')
@Controller('service-tickets')
@UseGuards(SessionGuard, RolesGuard)
@ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
@ApiResponse({
  status: 403,
  description: 'Authenticated but not allowed',
  type: ApiErrorResponseDto,
})
export class ServiceTicketsController {
  constructor(private readonly serviceTickets: ServiceTicketsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Create a service ticket for a facility' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Client-generated UUID. Retrying with the same key returns the original ticket.',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 201, description: 'The created ticket', type: ServiceTicketResponseDto })
  @ApiResponse({
    status: 200,
    description: 'Idempotent response — ticket already created',
    type: ServiceTicketResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Another request is processing the same idempotency key',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'Same idempotency key reused with different payload',
    type: ApiErrorResponseDto,
  })
  async create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthUser,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ServiceTicketResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Header Idempotency-Key là bắt buộc');
    }
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key phải là UUID hợp lệ');
    }

    const { data, isRetry } = await this.serviceTickets.create(dto, user, idempotencyKey);
    res.status(isRetry ? HttpStatus.OK : HttpStatus.CREATED);
    return data;
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF)
  @ApiOperation({
    summary: 'List tickets visible to the authenticated user',
    description:
      'ADMIN sees all tickets; CUSTOMER sees their own tickets; FACILITY_MANAGER sees tickets of ' +
      'their facilities; FACILITY_STAFF sees only tickets assigned to them.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tickets',
    type: ServiceTicketListResponseDto,
  })
  list(
    @Query() query: ListTicketsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketListResponse> {
    return this.serviceTickets.list(query, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF)
  @ApiOperation({ summary: 'Get a single ticket the authenticated user can access' })
  @ApiResponse({ status: 200, description: 'The ticket', type: ServiceTicketResponseDto })
  @ApiResponse({ status: 404, description: 'Ticket not found', type: ApiErrorResponseDto })
  getOne(
    @Param() params: TicketIdParamDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketResponse> {
    return this.serviceTickets.getOne(params.id, user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Assign a facility staff member to a ticket' })
  @ApiResponse({
    status: 200,
    description: 'The ticket with the new assignee',
    type: ServiceTicketResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Ticket not found', type: ApiErrorResponseDto })
  assign(
    @Param() params: TicketIdParamDto,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketResponse> {
    return this.serviceTickets.assign(params.id, dto, user);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.CUSTOMER, UserRole.FACILITY_MANAGER)
  @ApiOperation({
    summary: 'Cancel an open ticket (owning customer or facility manager of the ticket)',
  })
  @ApiResponse({ status: 200, description: 'The cancelled ticket', type: ServiceTicketResponseDto })
  @ApiResponse({ status: 404, description: 'Ticket not found', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Ticket is not in a cancellable status',
    type: ApiErrorResponseDto,
  })
  cancel(
    @Param() params: TicketIdParamDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketResponse> {
    return this.serviceTickets.cancel(params.id, user);
  }

  @Patch(':id')
  @Roles(UserRole.FACILITY_STAFF, UserRole.FACILITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Update processing fields of a ticket — assigned staff, facility manager of the ticket, or admin',
  })
  @ApiResponse({ status: 200, description: 'The updated ticket', type: ServiceTicketResponseDto })
  @ApiResponse({ status: 404, description: 'Ticket not found', type: ApiErrorResponseDto })
  update(
    @Param() params: TicketIdParamDto,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketResponse> {
    return this.serviceTickets.update(params.id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a service ticket (ADMIN only — everyone else uses the cancel flow)',
  })
  @ApiResponse({ status: 200, description: 'Ticket deleted', type: ServiceTicketDeleteResponseDto })
  @ApiResponse({ status: 404, description: 'Ticket not found', type: ApiErrorResponseDto })
  remove(
    @Param() params: TicketIdParamDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketDeleteResponse> {
    return this.serviceTickets.remove(params.id, user);
  }
}
