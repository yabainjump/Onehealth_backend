import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AddAlertCommentDto } from './dto/add-alert-comment.dto';

@ApiTags('Alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // ---- LECTURE : publique (auth optionnelle) ----

  @ApiOperation({ summary: 'Lister les alertes One Health (filtres) — public' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(
    @Req() req: RequestWithUser,
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('country') country?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const parsedLimit = parseInt(`${limit ?? ''}`, 10);
    const parsedPage = parseInt(`${page ?? ''}`, 10);
    return this.alertsService.list(
      {
        category,
        severity,
        country,
        verificationStatus,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      },
      req.user?.id ?? '',
    );
  }

  @ApiOperation({
    summary: "Alertes les plus proches d'un point (lat/lng) — public",
  })
  @UseGuards(OptionalJwtAuthGuard)
  @Get('near')
  near(
    @Req() req: RequestWithUser,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('category') category?: string,
    @Query('verificationStatus') verificationStatus?: string,
  ) {
    const parsedRadius = parseInt(`${radiusKm ?? ''}`, 10);
    return this.alertsService.near(
      parseFloat(`${lat}`),
      parseFloat(`${lng}`),
      Number.isFinite(parsedRadius) ? parsedRadius : 100,
      category,
      verificationStatus,
      100,
      req.user?.id ?? '',
    );
  }

  @ApiOperation({ summary: "Lister les commentaires d'une alerte — public" })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/comments')
  listComments(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.alertsService.listComments(id, req.user?.id ?? '');
  }

  @ApiOperation({ summary: "Détail d'une alerte — public" })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findById(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.alertsService.findById(id, req.user?.id ?? '');
  }

  // ---- ECRITURE : connexion requise ----

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Signaler une alerte One Health' })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(req.user.id, dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Modifier une alerte (auteur)' })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alertsService.update(id, req.user.id, dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Aimer une alerte' })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  like(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.alertsService.like(id, req.user.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Retirer son like d'une alerte" })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  unlike(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.alertsService.unlike(id, req.user.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Commenter une alerte' })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  comment(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AddAlertCommentDto,
  ) {
    return this.alertsService.addComment(id, req.user.id, dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Supprimer un commentaire (auteur du commentaire ou de l'alerte)",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @ApiParam({ name: 'commentId', description: 'Identifiant du commentaire' })
  @UseGuards(JwtAuthGuard)
  @Delete(':id/comments/:commentId')
  deleteComment(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.alertsService.deleteComment(id, commentId, req.user.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Supprimer une alerte (auteur)' })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.alertsService.remove(id, req.user.id);
  }
}
