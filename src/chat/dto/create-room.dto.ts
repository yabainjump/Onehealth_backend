import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: "Identifiant (ObjectId Mongo) de l'autre membre du salon.",
  })
  @IsMongoId()
  memberId: string;
}
