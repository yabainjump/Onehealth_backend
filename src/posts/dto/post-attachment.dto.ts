import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsSafeMediaUrl } from '../../common/validation/safe-media-url.validator';

export const POST_ATTACHMENT_TYPES = ['video', 'document'] as const;
export type PostAttachmentType = (typeof POST_ATTACHMENT_TYPES)[number];

export class PostAttachmentDto {
  @ApiProperty({ enum: POST_ATTACHMENT_TYPES, example: 'document' })
  @IsString()
  @IsIn(POST_ATTACHMENT_TYPES)
  type: PostAttachmentType;

  @ApiProperty({
    example: '/uploads/post/1700000000000-abc.pdf',
    description: 'URL renvoyée par POST /api/upload/post.',
    maxLength: 1000,
  })
  @IsString()
  @IsSafeMediaUrl()
  @MaxLength(1000)
  url: string;

  @ApiProperty({ example: 'rapport-2026.pdf', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf', maxLength: 150 })
  @IsString()
  @MaxLength(150)
  mimeType: string;

  @ApiProperty({
    example: 482910,
    description: 'Taille en octets.',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  size: number;
}
