import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class UploadInspectionEvidenceDto {
  @ApiProperty({
    example: 'https://r2.example.com/uploads/1728300000000-ab12cd-photo.jpg',
    description: 'Public URL of the file already uploaded to R2 (via presigned PUT URL)',
    maxLength: 2048,
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  evidenceUrl: string;
}
