import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ example: 'Bonjour, comment allez-vous ?', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;

  @ApiPropertyOptional({
    example: '/uploads/message/1700000000000-a.webp',
    description: 'URL d\'image (renvoyée par /api/upload/message).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({
    example: '/uploads/message/1700000000000-doc.pdf',
    description: 'URL de fichier (renvoyée par /api/upload/message).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string;

  @ApiPropertyOptional({ example: 'rapport.pdf', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ example: 'application/pdf', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fileMimeType?: string;

  @ApiPropertyOptional({ example: 482910, description: 'Taille du fichier en octets.', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50 * 1024 * 1024)
  fileSize?: number;
}
