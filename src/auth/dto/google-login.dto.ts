import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description:
      "ID token JWT renvoyé par Google Identity Services côté client (credential.credential).",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken: string;
}
