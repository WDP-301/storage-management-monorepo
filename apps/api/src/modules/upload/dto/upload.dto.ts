import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetPresignedUrlDto {
  @ApiProperty({ example: 'pallet-photo-001.jpg', description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 'image/jpeg', description: 'MIME type of the file' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiPropertyOptional({
    example: 'inventory-items',
    default: 'uploads',
    description: 'Subfolder path in S3',
  })
  @IsString()
  @IsOptional()
  folder?: string = 'uploads';
}
