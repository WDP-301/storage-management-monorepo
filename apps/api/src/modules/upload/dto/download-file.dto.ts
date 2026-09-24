import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DownloadFileQueryDto {
  @ApiProperty({ example: 'uploads/sample.png' })
  @IsString()
  @IsNotEmpty()
  fileKey: string;
}

export class FileKeyParamDto {
  @ApiProperty({ example: 'sample.png' })
  @IsString()
  @IsNotEmpty()
  key: string;
}
