import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { SendRudolfMessageDto } from './dto/send-rudolf-message.dto';
import { RudolfRateLimitGuard } from './rudolf-rate-limit.guard';
import { RudolfService } from './rudolf.service';

@ApiTags('Rudolf AI')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rudolf')
export class RudolfController {
  constructor(private readonly rudolfService: RudolfService) {}

  @ApiOperation({ summary: 'Charger ma conversation privée avec Rudolf' })
  @Get('conversation')
  getConversation(@Req() request: RequestWithUser) {
    return this.rudolfService.getConversation(request.user.id);
  }

  @ApiOperation({ summary: 'Envoyer une question One Health à Rudolf' })
  @UseGuards(RudolfRateLimitGuard)
  @Post('messages')
  sendMessage(
    @Req() request: RequestWithUser,
    @Body() dto: SendRudolfMessageDto,
  ) {
    return this.rudolfService.sendMessage(request.user.id, dto);
  }

  @ApiOperation({ summary: 'Effacer ma conversation Rudolf' })
  @Delete('conversation')
  resetConversation(@Req() request: RequestWithUser) {
    return this.rudolfService.resetConversation(request.user.id);
  }
}
