import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsSafeMediaUrl } from '../../common/validation/safe-media-url.validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'dr_kamga', minLength: 3, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  username?: string;

  @ApiPropertyOptional({ example: 'Jean' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Kamga' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Hôpital Central de Yaoundé' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  institution?: string;

  @ApiPropertyOptional({ example: 'Vétérinaire' })
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
    description: 'Photo de profil (URL renvoyée par /api/upload/profile).',
  })
  @IsOptional()
  @IsString()
  @IsSafeMediaUrl()
  @MaxLength(500)
  photoURL?: string;

  @ApiPropertyOptional({
    example: '/uploads/profile/1700000000000-cover.webp',
    description: 'Photo de couverture (URL renvoyée par /api/upload/profile).',
  })
  @IsOptional()
  @IsString()
  @IsSafeMediaUrl()
  @MaxLength(500)
  coverPhotoURL?: string;
}
