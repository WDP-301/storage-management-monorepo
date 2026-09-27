import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123', description: 'Current account password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword123',
    minLength: 8,
    maxLength: 72,
    description: 'New password (8-72 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;

  @ApiProperty({ example: 'NewPassword123', description: 'Must match newPassword' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  confirmPassword: string;
}
