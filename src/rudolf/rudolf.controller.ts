import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { once } from 'node:events';
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

  @ApiOperation({ summary: 'Lister mes conversations privées avec Rudolf' })
  @Get('conversations')
  listConversations(@Req() request: RequestWithUser) {
    return this.rudolfService.listConversations(request.user.id);
  }

  @ApiOperation({ summary: 'Créer une nouvelle conversation Rudolf' })
  @Post('conversations')
  createConversation(@Req() request: RequestWithUser) {
    return this.rudolfService.createConversation(request.user.id);
  }

  @ApiOperation({ summary: 'Charger une conversation Rudolf privée' })
  @Get('conversations/:conversationId')
  getConversation(
    @Req() request: RequestWithUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.rudolfService.getConversationById(
      request.user.id,
      conversationId,
    );
  }

  @ApiOperation({ summary: 'Supprimer une conversation Rudolf privée' })
  @Delete('conversations/:conversationId')
  deleteConversation(
    @Req() request: RequestWithUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.rudolfService.deleteConversation(
      request.user.id,
      conversationId,
    );
  }

  @ApiOperation({
    summary: 'Envoyer une question et diffuser la réponse Rudolf',
  })
  @UseGuards(RudolfRateLimitGuard)
  @Post('conversations/:conversationId/messages/stream')
  async streamMessage(
    @Req() request: RequestWithUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendRudolfMessageDto,
    @Res() response: Response,
  ): Promise<void> {
    response.status(HttpStatus.OK);
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    try {
      const result = await this.rudolfService.streamMessage(
        request.user.id,
        conversationId,
        dto,
        async (content) => {
          await this.writeStreamEvent(response, { type: 'delta', content });
        },
      );
      await this.writeStreamEvent(response, { type: 'done', ...result });
    } catch (error) {
      const status =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.SERVICE_UNAVAILABLE;
      await this.writeStreamEvent(response, {
        type: 'error',
        status,
        code: this.streamErrorCode(status),
      });
    } finally {
      if (!response.writableEnded) response.end();
    }
  }

  @ApiOperation({ summary: 'Envoyer une question sans streaming' })
  @UseGuards(RudolfRateLimitGuard)
  @Post('conversations/:conversationId/messages')
  sendConversationMessage(
    @Req() request: RequestWithUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendRudolfMessageDto,
  ) {
    return this.rudolfService.sendMessageToConversation(
      request.user.id,
      conversationId,
      dto,
    );
  }

  // Routes conservées pour les anciennes versions déjà installées.
  @ApiOperation({ summary: 'Charger la conversation Rudolf historique' })
  @Get('conversation')
  getLegacyConversation(@Req() request: RequestWithUser) {
    return this.rudolfService.getConversation(request.user.id);
  }

  @ApiOperation({ summary: 'Envoyer une question depuis un ancien client' })
  @UseGuards(RudolfRateLimitGuard)
  @Post('messages')
  sendLegacyMessage(
    @Req() request: RequestWithUser,
    @Body() dto: SendRudolfMessageDto,
  ) {
    return this.rudolfService.sendMessage(request.user.id, dto);
  }

  @ApiOperation({
    summary: 'Effacer les conversations depuis un ancien client',
  })
  @Delete('conversation')
  resetLegacyConversation(@Req() request: RequestWithUser) {
    return this.rudolfService.resetConversation(request.user.id);
  }

  private async writeStreamEvent(
    response: Response,
    event: Record<string, unknown>,
  ): Promise<void> {
    if (response.destroyed || response.writableEnded) return;
    const canContinue = response.write(`${JSON.stringify(event)}\n`);
    if (canContinue) return;
    await Promise.race([once(response, 'drain'), once(response, 'close')]);
  }

  private streamErrorCode(status: number): string {
    if (status === 429) return 'rate_limit';
    if (status === 404) return 'not_found';
    if (status === 504) return 'timeout';
    if (status === 409) return 'conversation_limit';
    return 'unavailable';
  }
}
