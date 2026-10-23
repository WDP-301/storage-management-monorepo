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
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RawResponse } from '@shared/decorators/raw-response.decorator';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ApiErrorResponseDto, ErrorCode } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { DownloadFileQueryDto, FileKeyParamDto } from './dto/download-file.dto';
import { GetPresignedUrlDto, MAX_UPLOAD_BYTES } from './dto/upload.dto';
import {
  DeleteFileResponseDto,
  DownloadUrlResponseDto,
  PresignedUploadUrlResponseDto,
  UploadResultDto,
} from './dto/upload-response.dto';
import { assertCanReadFile, assertFileKeyUnreferenced } from './file-references.util';
import { buildUploadKey, UploadService } from './upload.service';

@ApiTags('Uploads (S3)')
@Controller('uploads')
@UseGuards(SessionGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly dataSource: DataSource,
  ) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate S3 presigned PUT URL for client-side direct upload' })
  @ApiResponse({
    status: 201,
    description: 'Presigned upload URL with expiry',
    type: PresignedUploadUrlResponseDto,
  })
  async getPresignedUrl(@Body() dto: GetPresignedUrlDto, @CurrentUser() user: AuthUser) {
    return this.uploadService.generatePresignedUploadUrl(
      dto.fileName,
      dto.mimeType,
      dto.fileSize,
      user.id,
    );
  }

  @Get('download-url')
  @ApiOperation({ summary: 'Generate S3 presigned GET URL for secure download' })
  @ApiQuery({ name: 'fileKey', example: 'uploads/sample.png' })
  @ApiResponse({ status: 200, type: DownloadUrlResponseDto })
  @ApiResponse({
    status: 403,
    description: 'A customer asking for a file not attached to anything of theirs',
    type: ApiErrorResponseDto,
  })
  async getDownloadUrl(@Query() query: DownloadFileQueryDto, @CurrentUser() user: AuthUser) {
    await assertCanReadFile(this.dataSource.manager, user, query.fileKey);
    const downloadUrl = await this.uploadService.generatePresignedDownloadUrl(query.fileKey);
    return { downloadUrl };
  }

  @Post('direct')
  @ApiOperation({ summary: 'Upload file directly through API to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: UploadResultDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadDirect(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    if (!file) {
      throw new DomainException(ErrorCode.VALIDATION_FAILED, 'No file provided', 400, {
        fields: [{ field: 'file', code: 'isNotEmpty', message: 'file is required' }],
      });
    }

    return this.uploadService.uploadBuffer(
      buildUploadKey(file.originalname, user.id),
      file.buffer,
      file.mimetype || 'application/octet-stream',
    );
  }

  // Express 5 named splat: matches /uploads/stream/<key> and yields segments as an array.
  @Get('stream/{*fileKey}')
  @RawResponse()
  @ApiOperation({ summary: 'Stream file directly from S3 storage (binary, not enveloped)' })
  @ApiResponse({
    status: 200,
    content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
  })
  async streamFile(
    @Param('fileKey') fileKey: string[] | string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const key = Array.isArray(fileKey) ? fileKey.join('/') : fileKey;
    await assertCanReadFile(this.dataSource.manager, user, key);
    const { stream, contentType } = await this.uploadService.getFileStream(key);
    res.setHeader('Content-Type', contentType);
    // Served from the API's origin — the web app's too, through its /api proxy. The uploader
    // chose the content type, so the browser must never render it as a page: an HTML or SVG
    // upload would otherwise run script as whoever opens the link.
    const fileName =
      key
        .split('/')
        .pop()
        ?.replace(/[^A-Za-z0-9._-]/g, '_') || 'file';
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    stream.pipe(res);
  }

  // No app deletes uploads; without an owner on each file only an admin may remove one.
  @Delete(':key')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete file from S3 (admin)' })
  @ApiResponse({ status: 200, type: DeleteFileResponseDto })
  @ApiResponse({
    status: 409,
    description: 'FILE_IN_USE: evidence of a finalized inspection or a settlement',
    type: ApiErrorResponseDto,
  })
  async deleteFile(@Param() params: FileKeyParamDto) {
    await assertFileKeyUnreferenced(this.dataSource.manager, params.key);
    return this.uploadService.deleteFile(params.key);
  }
}
