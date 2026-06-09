import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { ChatService } from './chat.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({
    summary: 'Créer (ou récupérer) un salon avec un autre utilisateur',
  })
  @Post('rooms')
  createRoom(@Req() req: RequestWithUser, @Body() dto: CreateRoomDto) {
    return this.chatService.createRoom(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Lister mes salons de discussion' })
  @Get('rooms')
  listRooms(@Req() req: RequestWithUser) {
    return this.chatService.listRooms(req.user.id);
  }

  @ApiOperation({ summary: 'Lister les messages d\'un salon' })
  @ApiParam({ name: 'roomId', description: 'Identifiant du salon' })
  @Get('rooms/:roomId/messages')
  listMessages(
    @Req() req: RequestWithUser,
    @Param('roomId', ParseObjectIdPipe) roomId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.chatService.listMessages(roomId, req.user.id, query);
  }

  @ApiOperation({ summary: 'Envoyer un message dans un salon' })
  @ApiParam({ name: 'roomId', description: 'Identifiant du salon' })
  @Post('rooms/:roomId/messages')
  sendMessage(
    @Req() req: RequestWithUser,
    @Param('roomId', ParseObjectIdPipe) roomId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(roomId, req.user.id, dto);
  }

  @ApiOperation({ summary: 'Marquer un salon comme lu' })
  @ApiParam({ name: 'roomId', description: 'Identifiant du salon' })
  @Post('rooms/:roomId/read')
  markRead(@Req() req: RequestWithUser, @Param('roomId', ParseObjectIdPipe) roomId: string) {
    return this.chatService.markRead(roomId, req.user.id);
  }
}
