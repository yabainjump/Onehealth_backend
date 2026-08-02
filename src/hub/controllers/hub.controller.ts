import {
  Body,
  Controller,
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import type { RequestWithUser } from '../../users/interfaces/request-with-user.interface';
import { HubSignalDecisionDto } from '../dto/hub-signal-decision.dto';
import { ListHubConnectorsDto } from '../dto/list-hub-connectors.dto';
import { ListHubObservationsDto } from '../dto/list-hub-observations.dto';
import { HubAdminGuard } from '../guards/hub-admin.guard';
import { HubAccessGuard } from '../guards/hub-access.guard';
import { HubVerifierGuard } from '../guards/hub-verifier.guard';
import { HubConnectorService } from '../services/hub-connector.service';
import { HubDemoSeedService } from '../services/hub-demo-seed.service';
import { HubService } from '../services/hub.service';

@ApiTags('Hub régional CEEAC')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, HubAccessGuard)
@Controller('hub')
export class HubController {
  constructor(
    private readonly hubService: HubService,
    private readonly connectorService: HubConnectorService,
    private readonly demoSeedService: HubDemoSeedService,
  ) {}

  @ApiOperation({ summary: 'Indicateurs du Hub selon la portée autorisée' })
  @Get('summary')
  summary(@Req() request: RequestWithUser) {
    return this.hubService.summary(request.user);
  }

  @ApiOperation({
    summary: 'Liste paginée des observations, signaux et alertes',
  })
  @Get('observations')
  observations(
    @Req() request: RequestWithUser,
    @Query() query: ListHubObservationsDto,
  ) {
    return this.hubService.listObservations(query, request.user);
  }

  @ApiOperation({ summary: "Dossier complet d'une observation du Hub" })
  @ApiParam({ name: 'id', example: 'OBS-DHIS2-CM-01' })
  @Get('observations/:id')
  observation(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.hubService.observationDetail(id, request.user);
  }

  @ApiOperation({ summary: 'Indicateurs de disponibilité des connecteurs' })
  @Get('connectors/summary')
  connectorSummary(@Req() request: RequestWithUser) {
    return this.connectorService.summary(request.user);
  }

  @ApiOperation({ summary: 'Liste supervisée des connecteurs autorisés' })
  @Get('connectors')
  connectors(
    @Req() request: RequestWithUser,
    @Query() query: ListHubConnectorsDto,
  ) {
    return this.connectorService.list(query, request.user);
  }

  @ApiOperation({
    summary:
      'Relancer les connecteurs de démonstration sans dupliquer les observations',
  })
  @UseGuards(HubAdminGuard)
  @Post('connectors/synchronize')
  synchronizeConnectors(@Req() request: RequestWithUser) {
    return this.connectorService.synchronize(request.user);
  }

  @ApiOperation({ summary: "S'assigner un signal et démarrer sa vérification" })
  @ApiParam({ name: 'signalCode', example: 'SIG-ARIS-AO-01' })
  @UseGuards(HubVerifierGuard)
  @Patch('signals/:signalCode/assign')
  assignSignal(
    @Req() request: RequestWithUser,
    @Param('signalCode') signalCode: string,
  ) {
    return this.hubService.assignSignal(signalCode, request.user);
  }

  @ApiOperation({
    summary: 'Vérifier ou rejeter un signal avec justification humaine',
  })
  @ApiParam({ name: 'signalCode', example: 'SIG-ARIS-AO-01' })
  @UseGuards(HubVerifierGuard)
  @Patch('signals/:signalCode/decision')
  decideSignal(
    @Req() request: RequestWithUser,
    @Param('signalCode') signalCode: string,
    @Body() dto: HubSignalDecisionDto,
  ) {
    return this.hubService.decideSignal(
      signalCode,
      dto.status,
      dto.note,
      request.user,
    );
  }

  @ApiOperation({
    summary: 'Charger le jeu de démonstration idempotent (administrateur)',
  })
  @UseGuards(AdminGuard)
  @Post('demo/seed')
  seedDemo() {
    return this.demoSeedService.seed();
  }
}
