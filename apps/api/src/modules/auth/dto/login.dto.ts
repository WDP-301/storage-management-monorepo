import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'customer@example.com', description: 'Account email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'secret123', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
