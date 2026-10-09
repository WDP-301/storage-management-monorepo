import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { OptionalSessionGuard } from '@modules/auth/guards/optional-session.guard';
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
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import { TourAppointmentStatus, UserRole } from '@storage/types';
import { AssignTourAppointmentDto } from './dto/assign-tour-appointment.dto';
import { CancelTourAppointmentDto } from './dto/cancel-tour-appointment.dto';
import { CompleteTourAppointmentDto } from './dto/complete-tour-appointment.dto';
import { ConfirmTourAppointmentDto } from './dto/confirm-tour-appointment.dto';
import { CreateContactTourDto } from './dto/create-contact-tour.dto';
import { ListTourAppointmentsQueryDto } from './dto/list-tour-appointments-query.dto';
import {
  TourAppointmentListResponseDto,
  TourAppointmentResponseDto,
} from './dto/tour-appointment-response.dto';
import { TourAppointmentsService } from './tour-appointments.service';
import type {
  TourAppointmentListResponse,
  TourAppointmentResponse,
} from './types/tour-appointment';

@ApiTags('Tour Appointments')
@Controller('tour-appointments')
export class TourAppointmentsController {
  constructor(private readonly service: TourAppointmentsService) {}

  @Post('contact')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OptionalSessionGuard)
  @ApiOperation({
    summary: 'Khách hàng gửi form liên hệ / đăng ký hẹn xem kho',
    description:
      'Endpoint công khai cho phép khách vãng lai hoặc khách hàng đã đăng nhập gửi thông tin nhu cầu và đặt lịch hẹn đến xem cơ sở kho.',
  })
  @ApiBody({
    type: CreateContactTourDto,
    description:
      'Thông tin liên hệ và ngày giờ mong muốn của khách hàng. Các trường bắt buộc: facilityId, fullName, phone, email, preferredDate. Các trường tùy chọn: preferredTimeSlot, customerNotes, storageUnitId.',
  })
  @ApiResponse({
    status: 201,
    description: 'Đã tiếp nhận yêu cầu liên hệ thành công',
    type: TourAppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu gửi lên không hợp lệ',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy cơ sở hoặc kho tương ứng',
    type: ApiErrorResponseDto,
  })
  async createContact(
    @Body() dto: CreateContactTourDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<TourAppointmentResponse> {
    return this.service.createContactRequest(dto, user?.id ?? null);
  }

  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Danh sách lịch hẹn xem kho',
    description:
      'Lấy danh sách các cuộc hẹn xem kho kèm phân trang và bộ lọc. Tất cả query parameters đều là tùy chọn. Quản lý cơ sở (FACILITY_MANAGER) chỉ thấy các cuộc hẹn của cơ sở mình quản lý. Nhân viên (FACILITY_STAFF) chỉ thấy các cuộc hẹn được phân công. ADMIN xem toàn bộ.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: '(Tùy chọn) Trang cần xem (bắt đầu từ 1, mặc định: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: '(Tùy chọn) Số lượng kết quả trên một trang (mặc định: 20, tối đa: 100)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TourAppointmentStatus,
    description:
      '(Tùy chọn) Lọc theo trạng thái cuộc hẹn (PENDING, CONFIRMED, ASSIGNED, COMPLETED, CANCELLED)',
  })
  @ApiQuery({
    name: 'facilityId',
    required: false,
    type: String,
    format: 'uuid',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: '(Tùy chọn) Lọc theo cơ sở kho (Facility ID)',
  })
  @ApiQuery({
    name: 'assignedTo',
    required: false,
    type: String,
    format: 'uuid',
    example: 'c1b48b61-d703-4f93-8ef4-9e3f225d3fa2',
    description: '(Tùy chọn) Lọc theo nhân viên cơ sở được phân công (Assigned To Staff ID)',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    example: '2026-10-01',
    description: '(Tùy chọn) Lọc các cuộc hẹn từ ngày (định dạng YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    example: '2026-10-31',
    description: '(Tùy chọn) Lọc các cuộc hẹn đến ngày (định dạng YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách cuộc hẹn xem kho kèm thông tin phân trang',
    type: TourAppointmentListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập / Phiên hết hạn',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập', type: ApiErrorResponseDto })
  async list(
    @Query() query: ListTourAppointmentsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TourAppointmentListResponse> {
    return this.service.listAppointments(query, user);
  }

  @Get(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF, UserRole.ADMIN, UserRole.CUSTOMER)
  @ApiOperation({
    summary: 'Chi tiết một cuộc hẹn xem kho',
    description:
      'Xem thông tin chi tiết cuộc hẹn bao gồm khách hàng, cơ sở, kho quan tâm, nhân viên được gán và các ghi chú kết quả.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Mã định danh duy nhất (UUID) của cuộc hẹn',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin chi tiết cuộc hẹn',
    type: TourAppointmentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xem cuộc hẹn này',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy cuộc hẹn', type: ApiErrorResponseDto })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<TourAppointmentResponse> {
    return this.service.getAppointment(id, user);
  }

  @Patch(':id/confirm')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.FACILITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Quản lý cơ sở xác nhận lịch hẹn xem kho',
    description:
      'Quản lý cơ sở sau khi liên hệ trao đổi với khách sẽ ghi nhận/chốt lịch xem chính thức. Trạng thái cuộc hẹn chuyển sang CONFIRMED.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Mã định danh duy nhất (UUID) của cuộc hẹn',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: ConfirmTourAppointmentDto,
    description:
      'Thông tin ngày giờ đã chốt lại với khách và ghi chú tiếp nhận của Manager (tất cả các trường đều là tùy chọn).',
  })
  @ApiResponse({
    status: 200,
    description: 'Xác nhận cuộc hẹn thành công',
    type: TourAppointmentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập', type: ApiErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Người dùng không quản lý cơ sở của cuộc hẹn này',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Trạng thái cuộc hẹn không hợp lệ để xác nhận (ví dụ đã hủy hoặc đã hoàn tất)',
    type: ApiErrorResponseDto,
  })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmTourAppointmentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TourAppointmentResponse> {
    return this.service.confirmAppointment(id, dto, user);
  }

  @Patch(':id/assign')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.FACILITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Quản lý cơ sở phân công nhân viên cơ sở dẫn khách',
    description:
      'Gán một nhân viên đang có vai trò FACILITY_STAFF hoạt động tại chính cơ sở đó để đón tiếp và dẫn khách tham quan. Trạng thái cuộc hẹn chuyển sang ASSIGNED.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Mã định danh duy nhất (UUID) của cuộc hẹn',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: AssignTourAppointmentDto,
    description: '(Bắt buộc) Mã nhân viên cơ sở được phân công (assignedTo: UUID)',
  })
  @ApiResponse({
    status: 200,
    description: 'Phân công nhân viên thành công',
    type: TourAppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Nhân viên không tồn tại hoặc không thuộc cơ sở này',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Người dùng không quản lý cơ sở của cuộc hẹn này',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Không thể phân công cho cuộc hẹn đã hoàn tất hoặc đã bị hủy',
    type: ApiErrorResponseDto,
  })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTourAppointmentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TourAppointmentResponse> {
    return this.service.assignAppointment(id, dto, user);
  }

  @Patch(':id/complete')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.FACILITY_STAFF, UserRole.FACILITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Nhân viên hoàn tất ca dẫn khách xem kho',
    description:
      'Nhân viên cơ sở được phân công (hoặc Quản lý cơ sở) ghi nhận kết quả tư vấn sau khi dẫn khách xem kho thực tế. Trạng thái cuộc hẹn chuyển sang COMPLETED.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Mã định danh duy nhất (UUID) của cuộc hẹn',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: CompleteTourAppointmentDto,
    description: '(Bắt buộc) Ghi chú kết quả tư vấn của nhân viên (staffResultNotes: string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật hoàn tất ca dẫn xem kho thành công',
    type: TourAppointmentResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Chỉ nhân viên được phân công hoặc quản lý cơ sở mới có quyền cập nhật kết quả',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Cuộc hẹn đã hoàn tất từ trước hoặc đã bị hủy',
    type: ApiErrorResponseDto,
  })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTourAppointmentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TourAppointmentResponse> {
    return this.service.completeAppointment(id, dto, user);
  }

  @Patch(':id/cancel')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.FACILITY_STAFF, UserRole.FACILITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Hủy cuộc hẹn hoặc ghi nhận khách không đến (No-show)',
    description:
      'Nhân viên cơ sở hoặc Quản lý cơ sở ghi nhận hủy lịch hẹn kèm lý do cụ thể (khách hoãn, khách báo bận hoặc đã đợi nhưng khách không đến). Trạng thái cuộc hẹn chuyển sang CANCELLED.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Mã định danh duy nhất (UUID) của cuộc hẹn',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: CancelTourAppointmentDto,
    description: '(Bắt buộc) Lý do hủy hoặc ghi chú khách không đến (cancellationReason: string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Hủy cuộc hẹn thành công',
    type: TourAppointmentResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Chỉ nhân viên được phân công hoặc quản lý cơ sở mới có quyền hủy cuộc hẹn',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Không thể hủy cuộc hẹn đã hoàn tất',
    type: ApiErrorResponseDto,
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTourAppointmentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TourAppointmentResponse> {
    return this.service.cancelAppointment(id, dto, user);
  }
}
