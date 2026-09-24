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
import { GetPresignedUrlDto } from './dto/upload.dto';
import { UploadService } from './upload.service';

@ApiTags('Uploads (S3)')
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate S3 presigned PUT URL for client-side direct upload' })
  @ApiResponse({ status: 201, description: 'Presigned upload URL with expiry' })
  async getPresignedUrl(@Body() dto: GetPresignedUrlDto) {
    return this.uploadService.generatePresignedUploadUrl(dto.fileName, dto.mimeType, dto.folder);
  }

  @Get('download-url')
  @ApiOperation({ summary: 'Generate S3 presigned GET URL for secure download' })
  @ApiQuery({ name: 'fileKey', example: 'uploads/sample.png' })
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  async uploadDirect(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new DomainException(ErrorCode.VALIDATION_FAILED, 'No file provided', 400, {
        fields: [{ field: 'file', code: 'isNotEmpty', message: 'file is required' }],
      });
    }

    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `uploads/${Date.now()}-${cleanName}`;

    return this.uploadService.uploadBuffer(
      fileKey,
      file.buffer,
      file.mimetype || 'application/octet-stream',
    );
  }

  @Get('stream/*')
  @RawResponse()
  @ApiOperation({ summary: 'Stream file directly from S3 storage (binary, not enveloped)' })
  async streamFile(@Param('0') fileKey: string, @Res() res: Response) {
    const { stream, contentType } = await this.uploadService.getFileStream(fileKey);
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete file from S3' })
  async deleteFile(@Param() params: FileKeyParamDto) {
    return this.uploadService.deleteFile(params.key);
  }
}
