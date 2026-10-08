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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { ContractReturnService } from './contract-return.service';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import { ReturnRequestDto } from './dto/return-request.dto';
import { UploadContractEvidenceDto } from './dto/upload-contract-evidence.dto';

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
  ) {}

  @Post()
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
  @ApiOperation({ summary: 'List contracts excluding soft-deleted records' })
  findAll() {
    return this.contractsService.findAll();
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a contract by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.findById(id);
  }

  // Editing or deleting a contract can strand its unit (BOOKED/RENTED) — system-wide roles only.
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOperation({ summary: 'Update a contract' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Put(':id/evidence')
  @ApiOperation({ summary: 'Set the contract evidence URL (R2 public link)' })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto })
  uploadEvidence(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UploadContractEvidenceDto) {
    return this.contractsService.uploadEvidence(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a contract' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.softDelete(id);
  }
}
