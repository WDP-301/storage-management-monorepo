import { SessionGuard } from '@modules/auth/guards/session.guard';
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
import { ErrorCode } from '@shared/models/api-response';
import { Response } from 'express';
import { DownloadFileQueryDto, FileKeyParamDto } from './dto/download-file.dto';
import { GetPresignedUrlDto, MAX_UPLOAD_BYTES } from './dto/upload.dto';
import {
  DeleteFileResponseDto,
  DownloadUrlResponseDto,
  PresignedUploadUrlResponseDto,
  UploadResultDto,
} from './dto/upload-response.dto';
import { buildUploadKey, UploadService } from './upload.service';

@ApiTags('Uploads (S3)')
@Controller('uploads')
@UseGuards(SessionGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate S3 presigned PUT URL for client-side direct upload' })
  @ApiResponse({
    status: 201,
    description: 'Presigned upload URL with expiry',
    type: PresignedUploadUrlResponseDto,
  })
  async getPresignedUrl(@Body() dto: GetPresignedUrlDto) {
    return this.uploadService.generatePresignedUploadUrl(dto.fileName, dto.mimeType, dto.fileSize);
  }

  @Get('download-url')
  @ApiOperation({ summary: 'Generate S3 presigned GET URL for secure download' })
  @ApiQuery({ name: 'fileKey', example: 'uploads/sample.png' })
  @ApiResponse({ status: 200, type: DownloadUrlResponseDto })
  async getDownloadUrl(@Query() query: DownloadFileQueryDto) {
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
  async uploadDirect(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new DomainException(ErrorCode.VALIDATION_FAILED, 'No file provided', 400, {
        fields: [{ field: 'file', code: 'isNotEmpty', message: 'file is required' }],
      });
    }

    return this.uploadService.uploadBuffer(
      buildUploadKey(file.originalname),
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
  async streamFile(@Param('fileKey') fileKey: string[] | string, @Res() res: Response) {
    const key = Array.isArray(fileKey) ? fileKey.join('/') : fileKey;
    const { stream, contentType } = await this.uploadService.getFileStream(key);
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete file from S3' })
  @ApiResponse({ status: 200, type: DeleteFileResponseDto })
  async deleteFile(@Param() params: FileKeyParamDto) {
    return this.uploadService.deleteFile(params.key);
  }
}
