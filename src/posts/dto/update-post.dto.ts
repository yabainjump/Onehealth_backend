import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsSafeMediaUrl } from '../../common/validation/safe-media-url.validator';
import { Type } from 'class-transformer';
import { PostAttachmentDto } from './post-attachment.dto';

export class UpdatePostDto {
  @ApiPropertyOptional({
    example: 'Surveillance des zoonoses (mise à jour)',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    example: 'Texte mis à jour de la publication…',
    maxLength: 3000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  content?: string;

  @ApiPropertyOptional({
    type: [String],
    description: "URLs d'images. 8 max.",
    example: ['/uploads/post/1700000000000-a.webp'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsSafeMediaUrl({ each: true })
  @MaxLength(500, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({
    type: () => PostAttachmentDto,
    nullable: true,
    description: 'Pièce jointe (ou null pour la retirer).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PostAttachmentDto)
  attachment?: PostAttachmentDto | null;
}
