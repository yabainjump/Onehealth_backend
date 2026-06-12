import { Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Lister mes notifications (paginé)' })
  @Get()
  list(
    @Req() request: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const parsedLimit = parseInt(`${limit ?? ''}`, 10);
    const parsedPage = parseInt(`${page ?? ''}`, 10);
    return this.notificationsService.list(
      request.user.id,
      Number.isFinite(parsedLimit) ? parsedLimit : 30,
      Number.isFinite(parsedPage) ? parsedPage : 1,
    );
  }

  @ApiOperation({ summary: 'Nombre de notifications non lues' })
  @Get('unread-count')
  async unreadCount(@Req() request: RequestWithUser) {
    const count = await this.notificationsService.unreadCount(request.user.id);
    return { count };
  }

  @ApiOperation({ summary: 'Marquer toutes mes notifications comme lues' })
  @Patch('read')
  async markAllRead(@Req() request: RequestWithUser) {
    await this.notificationsService.markAllRead(request.user.id);
    return { success: true };
  }
}
