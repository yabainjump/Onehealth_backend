import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'jean.dupont@example.com',
    description: 'Adresse e-mail du compte.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'MotDePasse123',
    description: 'Mot de passe du compte.',
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
