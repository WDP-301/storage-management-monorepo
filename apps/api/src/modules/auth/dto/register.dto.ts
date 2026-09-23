import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Vietnamese mobile number: 0/+84/84 prefix followed by a 3/5/7/8/9 network prefix. */
const VIETNAMESE_PHONE_PATTERN = /^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/;

export class RegisterDto {
  @ApiProperty({ example: 'customer@example.com', description: 'Account email' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'secret123', minLength: 8, description: 'Account password' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Nguyen Van A', description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ example: '0912345678', description: 'Vietnamese mobile phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(VIETNAMESE_PHONE_PATTERN, {
    message: 'phone must be a valid Vietnamese phone number',
  })
  phone: string;
}
