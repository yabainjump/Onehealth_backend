import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'jean.dupont@example.com',
    description: 'E-mail du compte dont on veut réinitialiser le mot de passe.',
  })
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email: string;
}
