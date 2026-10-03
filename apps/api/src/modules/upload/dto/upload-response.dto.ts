import { ApiProperty } from '@nestjs/swagger';
import type { PresignedUploadUrlResponse } from '../upload.service';

export class PresignedUploadUrlResponseDto implements PresignedUploadUrlResponse {
  @ApiProperty({ example: 'https://s3.example.com/bucket/uploads/123-abc-file.png?X-Amz-...' })
  uploadUrl: string;

  @ApiProperty({ example: 'uploads/1759478400000-a1b2c3-file.png' })
  fileKey: string;

  @ApiProperty({ example: 'https://s3.example.com/bucket/uploads/1759478400000-a1b2c3-file.png' })
  publicUrl: string;
}

export class DownloadUrlResponseDto {
  @ApiProperty({ example: 'https://s3.example.com/bucket/uploads/file.png?X-Amz-...' })
  downloadUrl: string;
}

export class UploadResultDto {
  @ApiProperty({ example: 'uploads/1759478400000-file.png' })
  key: string;

  @ApiProperty({ example: 'https://s3.example.com/bucket/uploads/1759478400000-file.png' })
  publicUrl: string;

  @ApiProperty({ example: 'storage-management-bucket' })
  bucket: string;

  @ApiProperty({ example: 102400 })
  size: number;
}

export class DeleteFileResponseDto {
  @ApiProperty({ example: 'uploads/1759478400000-file.png' })
  key: string;

  @ApiProperty({ example: true })
  deleted: boolean;
}
