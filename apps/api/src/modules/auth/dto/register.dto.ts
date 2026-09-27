import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Vietnamese mobile number: 0/+84/84 followed by a prefix assigned to a Vietnamese carrier
 * (Viettel 032-039/086/096-098, Vinaphone 081-085/088/091/094, Mobifone 070/076-079/089/090/093,
 * Vietnamobile 052/056/058/092, Gmobile 059/099, MVNO 055/087) and 7 digits.
 */
const VIETNAMESE_PHONE_PATTERN =
  /^(?:\+?84|0)(?:32|33|34|35|36|37|38|39|52|55|56|58|59|70|76|77|78|79|81|82|83|84|85|86|87|88|89|90|91|92|93|94|96|97|98|99)\d{7}$/;

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
