import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsSafeMediaUrl } from '../../common/validation/safe-media-url.validator';

export class RegisterDto {
  @ApiProperty({
    example: 'dr.kamga@example.com',
    description: 'Adresse e-mail (unique).',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'MotDePasse123',
    description: 'Mot de passe (8 à 128 caractères).',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'dr_kamga', minLength: 3, maxLength: 40 })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  username: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Kamga' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: 'Hôpital Central de Yaoundé' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  institution?: string;

  @ApiPropertyOptional({
    example: 'Vétérinaire',
    description: 'Spécialité / type de praticien.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  typeMedecin?: string;

  @ApiPropertyOptional({ example: 'Cameroun' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: 'Yaoundé' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: '+237 6 99 00 00 00' })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  @Matches(/^(\+?[0-9\s().-]{7,20})?$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'Spécialiste en santé publique vétérinaire.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  bio?: string;

  @ApiPropertyOptional({
    example: '/uploads/profile/1700000000000-abc.webp',
    description: 'URL renvoyée par POST /api/upload/profile.',
  })
  @IsOptional()
  @IsString()
  @IsSafeMediaUrl()
  @MaxLength(500)
  photoURL?: string;
}
