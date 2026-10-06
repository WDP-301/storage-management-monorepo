import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export class GetPresignedUrlDto {
  @ApiProperty({ example: 'pallet-photo-001.jpg', description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 'image/jpeg', description: 'MIME type of the file' })
  @IsString()
  @IsNotEmpty()
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
