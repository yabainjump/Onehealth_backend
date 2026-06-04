import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostAttachmentDto } from './post-attachment.dto';

export class CreatePostDto {
  @ApiPropertyOptional({ example: 'Surveillance des zoonoses', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    example: 'Nous lançons une nouvelle étude sur la rage en zone rurale…',
    maxLength: 3000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  content?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'URLs d\'images (renvoyées par /api/upload/post). 8 max.',
    example: ['/uploads/post/1700000000000-a.webp'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({
    type: () => PostAttachmentDto,
    description: 'Pièce jointe unique (vidéo ou document) à la place des images.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PostAttachmentDto)
  attachment?: PostAttachmentDto;
}
