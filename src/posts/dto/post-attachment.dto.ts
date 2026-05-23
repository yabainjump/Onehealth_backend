import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const POST_ATTACHMENT_TYPES = ['video', 'document'] as const;
export type PostAttachmentType = (typeof POST_ATTACHMENT_TYPES)[number];

export class PostAttachmentDto {
  @IsString()
  @IsIn(POST_ATTACHMENT_TYPES)
  type: PostAttachmentType;

  @IsString()
  @MaxLength(1000)
  url: string;

  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @MaxLength(150)
  mimeType: string;

  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  size: number;
}
