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
import { UpdateHubSharingPolicyDto } from '../dto/update-hub-sharing-policy.dto';
import { UpdateHubReportStatusDto } from '../dto/update-hub-report-status.dto';
import { ConsolidateHubEventDto } from '../dto/consolidate-hub-event.dto';
import { HubAdminGuard } from '../guards/hub-admin.guard';
import { HubAccessGuard } from '../guards/hub-access.guard';
import { HubVerifierGuard } from '../guards/hub-verifier.guard';
import { HubAnalystGuard } from '../guards/hub-analyst.guard';
import { HubConnectorService } from '../services/hub-connector.service';
import { HubDemoSeedService } from '../services/hub-demo-seed.service';
import { HubService } from '../services/hub.service';
import { HubScenarioService } from '../services/hub-scenario.service';
import { HubReportService } from '../services/hub-report.service';
import { HubEventService } from '../services/hub-event.service';
import { HubAiService } from '../services/hub-ai.service';
import { HubAiAssistantDto, HubAiScopeDto } from '../dto/hub-ai.dto';
import { RudolfRateLimitGuard } from '../../rudolf/rudolf-rate-limit.guard';

@ApiTags('Hub régional CEEAC')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, HubAccessGuard)
@Controller('hub')
export class HubController {
  constructor(
    private readonly hubService: HubService,
    private readonly connectorService: HubConnectorService,
    private readonly demoSeedService: HubDemoSeedService,
    private readonly scenarioService: HubScenarioService,
    private readonly reportService: HubReportService,
    private readonly eventService: HubEventService,
    private readonly aiService: HubAiService,
  ) {}

  @ApiOperation({
    summary: "Générer une synthèse Rudolf d'un dossier autorisé",
  })
  @UseGuards(HubAnalystGuard, RudolfRateLimitGuard)
  @Post('ai/alerts/:id/summary')
  aiAlertSummary(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.aiService.alertSummary(id, request.user);
  }

  @ApiOperation({ summary: 'Préparer un projet de rapport avec Rudolf' })
  @UseGuards(HubAnalystGuard, RudolfRateLimitGuard)
  @Post('ai/reports/draft')
  aiReport(@Req() request: RequestWithUser, @Body() dto: HubAiScopeDto) {
    return this.aiService.reportDraft(dto, request.user);
  }

  @ApiOperation({
    summary: 'Expliquer les rapprochements multisectoriels avec Rudolf',
  })
  @UseGuards(HubAnalystGuard, RudolfRateLimitGuard)
  @Post('ai/analyses/explain')
  aiAnalysis(@Req() request: RequestWithUser, @Body() dto: HubAiScopeDto) {
    return this.aiService.analysis(dto, request.user);
  }

  @ApiOperation({ summary: 'Interroger Rudolf sur les données Hub autorisées' })
  @UseGuards(HubAnalystGuard, RudolfRateLimitGuard)
  @Post('ai/assistant')
  aiAssistant(@Req() request: RequestWithUser, @Body() dto: HubAiAssistantDto) {
    return this.aiService.assistant(dto, request.user);
  }

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

  @ApiOperation({
    summary: 'Décisions et signaux nécessitant une action humaine',
  })
  @Get('decisions')
  decisions(@Req() request: RequestWithUser) {
    return this.hubService.decisions(request.user);
  }

  @ApiOperation({ summary: 'Événements One Health consolidés et explicables' })
  @Get('events')
  events(@Req() request: RequestWithUser) {
    return this.eventService.list(request.user);
  }

  @ApiOperation({
    summary: "Détail et observations sources d'un événement consolidé",
  })
  @Get('events/:eventCode')
  event(
    @Req() request: RequestWithUser,
    @Param('eventCode') eventCode: string,
  ) {
    return this.eventService.detail(eventCode, request.user);
  }

  @ApiOperation({
    summary: 'Consolider manuellement des observations corrélées',
  })
  @UseGuards(HubAnalystGuard)
  @Post('events')
  consolidateEvent(
    @Req() request: RequestWithUser,
    @Body() dto: ConsolidateHubEventDto,
  ) {
    return this.eventService.consolidate(dto.observationIds, request.user);
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
    summary: 'Registre des politiques de souveraineté autorisées',
  })
  @Get('sharing-policies')
  sharingPolicies(@Req() request: RequestWithUser) {
    return this.hubService.listSharingPolicies(request.user);
  }

  @ApiOperation({
    summary: 'Modifier une politique de partage et auditer la décision',
  })
  @ApiParam({ name: 'policyId', example: 'POLICY-DEMO-CM' })
  @UseGuards(HubAdminGuard)
  @Patch('sharing-policies/:policyId')
  updateSharingPolicy(
    @Req() request: RequestWithUser,
    @Param('policyId') policyId: string,
    @Body() dto: UpdateHubSharingPolicyDto,
  ) {
    return this.hubService.updateSharingPolicy(policyId, dto, request.user);
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

  @ApiOperation({ summary: 'État du scénario dynamique de démonstration' })
  @UseGuards(HubAdminGuard)
  @Get('demo/scenario')
  scenario() {
    return this.scenarioService.current();
  }

  @ApiOperation({ summary: 'Exécuter le scénario dynamique intersectoriel' })
  @UseGuards(HubAdminGuard)
  @Post('demo/scenario/run')
  runScenario(@Req() request: RequestWithUser) {
    return this.scenarioService.run(request.user);
  }

  @ApiOperation({ summary: "Versions de rapport d'une alerte vérifiée" })
  @Get('alerts/:observationId/reports')
  reports(
    @Req() request: RequestWithUser,
    @Param('observationId') observationId: string,
  ) {
    return this.reportService.list(observationId, request.user);
  }

  @ApiOperation({ summary: "Générer une nouvelle version du rapport d'alerte" })
  @UseGuards(HubAnalystGuard)
  @Post('alerts/:observationId/reports')
  generateReport(
    @Req() request: RequestWithUser,
    @Param('observationId') observationId: string,
  ) {
    return this.reportService.generate(observationId, request.user);
  }

  @ApiOperation({ summary: 'Faire progresser le workflow du rapport' })
  @UseGuards(HubAnalystGuard)
  @Patch('reports/:reportId/status')
  updateReportStatus(
    @Req() request: RequestWithUser,
    @Param('reportId') reportId: string,
    @Body() dto: UpdateHubReportStatusDto,
  ) {
    return this.reportService.transition(reportId, dto.status, request.user);
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
