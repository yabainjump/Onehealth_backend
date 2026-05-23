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
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PostAttachmentDto)
  attachment?: PostAttachmentDto;
}
