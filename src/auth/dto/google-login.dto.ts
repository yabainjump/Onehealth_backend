import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description:
      "ID token JWT renvoyé par Google Identity Services côté client (credential.credential).",
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
