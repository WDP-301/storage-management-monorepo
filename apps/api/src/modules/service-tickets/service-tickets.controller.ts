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
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
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
  @ApiResponse({ status: 201, description: 'The created ticket' })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketResponse> {
    return this.serviceTickets.create(dto, user);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF)
  @ApiOperation({
    summary: 'List tickets visible to the authenticated user',
    description:
      'CUSTOMER sees their own tickets; FACILITY_MANAGER sees tickets of their facilities; ' +
      'FACILITY_STAFF sees only tickets assigned to them.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of tickets' })
  list(
    @Query() query: ListTicketsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketListResponse> {
    return this.serviceTickets.list(query, user);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF)
  @ApiOperation({ summary: 'Get a single ticket the authenticated user can access' })
  @ApiResponse({ status: 200, description: 'The ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found', type: ApiErrorResponseDto })
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketResponse> {
    return this.serviceTickets.getOne(id, user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Assign a facility staff member to a ticket' })
  @ApiResponse({ status: 200, description: 'The ticket with the new assignee' })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Ticket not found', type: ApiErrorResponseDto })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketResponse> {
    return this.serviceTickets.assign(id, dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.FACILITY_STAFF)
  @ApiOperation({
    summary: 'Update processing fields of a ticket assigned to the authenticated staff member',
  })
  @ApiResponse({ status: 200, description: 'The updated ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found', type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketResponse> {
    return this.serviceTickets.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Delete a service ticket (ADMIN, FACILITY_MANAGER)' })
  @ApiResponse({ status: 200, description: 'Ticket deleted' })
  @ApiResponse({ status: 404, description: 'Ticket not found', type: ApiErrorResponseDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ServiceTicketDeleteResponse> {
    return this.serviceTickets.remove(id, user);
  }
}
