import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token de réinitialisation reçu par e-mail.',
    minLength: 20,
    maxLength: 256,
  })
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token: string;

  @ApiProperty({
    example: 'NouveauMotDePasse123',
    description: 'Nouveau mot de passe (8 à 128 caractères).',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
