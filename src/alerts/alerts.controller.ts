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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@ApiTags('Alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @ApiOperation({ summary: 'Lister les alertes One Health (filtres) — public' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const parsedLimit = parseInt(`${limit ?? ''}`, 10);
    const parsedPage = parseInt(`${page ?? ''}`, 10);
    return this.alertsService.list({
      category,
      severity,
      country,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
    });
  }

  @ApiOperation({ summary: 'Alertes les plus proches d\'un point (lat/lng) — public' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get('near')
  near(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('category') category?: string,
  ) {
    const parsedRadius = parseInt(`${radiusKm ?? ''}`, 10);
    return this.alertsService.near(
      parseFloat(`${lat}`),
      parseFloat(`${lng}`),
      Number.isFinite(parsedRadius) ? parsedRadius : 100,
      category,
    );
  }

  @ApiOperation({ summary: 'Détail d\'une alerte — public' })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findById(@Param('id', ParseObjectIdPipe) id: string) {
    return this.alertsService.findById(id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Signaler une alerte One Health' })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() request: RequestWithUser, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(request.user.id, dto);
  }
}
