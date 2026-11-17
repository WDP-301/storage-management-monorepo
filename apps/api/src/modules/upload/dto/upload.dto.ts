import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export class GetPresignedUrlDto {
  @ApiProperty({ example: 'pallet-photo-001.jpg', description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    example: 'image/jpeg',
    enum: ALLOWED_UPLOAD_MIME_TYPES,
    description: 'MIME type of the file (only JPEG, PNG, WebP, HEIC, HEIF, or PDF)',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_UPLOAD_MIME_TYPES)
  mimeType: string;

  @ApiProperty({
    example: 102400,
    description:
      'Exact size of the file in bytes. Signed into the presigned URL — the PUT fails unless Content-Length matches, so this bounds upload size.',
    maximum: MAX_UPLOAD_BYTES,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  fileSize: number;
}
