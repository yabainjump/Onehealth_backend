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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { ChatService } from './chat.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('rooms')
  createRoom(@Req() req: RequestWithUser, @Body() dto: CreateRoomDto) {
    return this.chatService.createRoom(req.user.id, dto);
  }

  @Get('rooms')
  listRooms(@Req() req: RequestWithUser) {
    return this.chatService.listRooms(req.user.id);
  }

  @Get('rooms/:roomId/messages')
  listMessages(
    @Req() req: RequestWithUser,
    @Param('roomId') roomId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.chatService.listMessages(roomId, req.user.id, query);
  }

  @Post('rooms/:roomId/messages')
  sendMessage(
    @Req() req: RequestWithUser,
    @Param('roomId') roomId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(roomId, req.user.id, dto);
  }

  @Post('rooms/:roomId/read')
  markRead(@Req() req: RequestWithUser, @Param('roomId') roomId: string) {
    return this.chatService.markRead(roomId, req.user.id);
  }
}
