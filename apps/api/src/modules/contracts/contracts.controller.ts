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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { ContractCancelService } from './contract-cancel.service';
import { ContractDocumentsService } from './contract-documents.service';
import { ContractQueryService } from './contract-query.service';
import { ContractReturnService } from './contract-return.service';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import { ReplaceContractDocumentsDto } from './dto/contract-documents.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { ReturnRequestDto } from './dto/return-request.dto';

@ApiTags('Contracts')
@Controller('contracts')
@UseGuards(SessionGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.FACILITY_MANAGER,
  UserRole.FACILITY_STAFF,
)
@ApiResponse({ status: 401, type: ApiErrorResponseDto })
@ApiResponse({ status: 403, type: ApiErrorResponseDto })
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly contractReturn: ContractReturnService,
    private readonly contractCancel: ContractCancelService,
    private readonly contractQuery: ContractQueryService,
    private readonly contractDocuments: ContractDocumentsService,
  ) {}

  // Writes can strand units, so they stay with system-wide roles. Contracts carry
  // customer PII: facility managers read only their own facilities, staff not at all.
  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: 'Create a contract from a confirmed booking item' })
  @ApiResponse({
    status: 409,
    description: 'BOOKING_NOT_CONFIRMED or BOOKING_ITEM_CONTRACT_WINDOW_EXPIRED',
    type: ApiErrorResponseDto,
  })
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({
    summary: 'List contracts with unit, facility, customer and inspections (paginated)',
    description: 'Facility managers only see the facilities they manage.',
  })
  findAll(@Query() query: ListContractsQueryDto, @CurrentUser() user: AuthUser) {
    return this.contractQuery.list(user, query);
  }

  @Get('mine')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: "List the caller's contracts with unit and facility info" })
  findMine(@CurrentUser() user: AuthUser) {
    return this.contractsService.findMine(user.id);
  }

  @Post(':id/return-request')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Ask to move out — opens a RETURN inspection on the chosen date' })
  @ApiResponse({ status: 409, description: 'Contract not ACTIVE or a return is already open' })
  requestReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractReturn.requestReturn(id, user.id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Cancel a DRAFT contract the customer never collected' })
  @ApiResponse({ status: 409, description: 'Contract is not DRAFT' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.contractCancel.cancelDraft(id, user);
  }

  @Get(':id/staff-view')
  @ApiOperation({
    summary: 'Contract file record for staff: files, handover, return and what the caller may edit',
    description:
      'Assigned inspector of the handover or latest return, facility managers of the unit, admin and operations.',
  })
  @ApiResponse({ status: 403, description: 'Not assigned and not a manager of this facility' })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto })
  staffView(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.contractQuery.staffView(id, user);
  }

  @Put(':id/documents')
  @ApiOperation({
    summary: 'Replace the signed contract files (images or PDF, at most 10)',
    description:
      'Managers of the unit facility, admin and operations while DRAFT/ACTIVE; the assigned handover inspector while the contract is DRAFT.',
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto })
  @ApiResponse({
    status: 409,
    description:
      'Contract ENDED/CANCELLED, or CONTRACT_DOCUMENTS_REQUIRED for ACTIVE with no files',
    type: ApiErrorResponseDto,
  })
  replaceDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceContractDocumentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractDocuments.replace(id, dto.documents, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER)
  @ApiOperation({ summary: 'Get a contract with unit, facility, customer and inspections' })
  @ApiResponse({ status: 403, description: 'Manager of another facility' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.contractQuery.detail(id, user);
  }

  // Editing or deleting a contract can strand its unit (BOOKED/RENTED) — system-wide roles only.
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: 'Update a contract' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a contract' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.softDelete(id);
  }
}
