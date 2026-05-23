import { IsMongoId } from 'class-validator';

export class CreateRoomDto {
  @IsMongoId()
  memberId: string;
}
