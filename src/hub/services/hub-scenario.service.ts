import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import type { RunHubScenarioDto } from '../dto/run-hub-scenario.dto';
import { HUB_DYNAMIC_SCENARIO_CODE } from '../hub.constants';
import { HubRepository } from '../repositories/hub.repository';
import { buildDynamicScenario } from '../scenarios/hub-dynamic-scenario.factory';
import {
  defaultHubScenarioConfiguration,
  HUB_SCENARIO_ANALYSIS_TYPE,
  HUB_SCENARIO_SECTORS,
  HUB_SCENARIO_SOURCE_SYSTEMS,
  type HubScenarioConfigurationSnapshot,
} from '../scenarios/hub-scenario-configuration';
import { buildScenarioSimulationReport } from '../scenarios/hub-scenario-report.factory';
import type {
  HubScenarioRunDocument,
  HubScenarioSimulationReport,
} from '../schemas/hub-scenario-run.schema';
import { HubDemoSeedService } from './hub-demo-seed.service';
import { HubEventService } from './hub-event.service';

@Injectable()
export class HubScenarioService {
  constructor(
    private readonly repository: HubRepository,
    private readonly eventService: HubEventService,
    private readonly demoSeedService: HubDemoSeedService,
  ) {}

  async current() {
    const run = await this.repository.findLatestScenario();
    if (run) return this.present(run);
    const scenario = buildDynamicScenario();
    return {
      scenarioCode: scenario.scenarioCode,
      title: scenario.title,
      description: scenario.description,
      status: 'READY',
      configuration: scenario.configuration,
      steps: scenario.steps.map((step) => ({
        ...step,
        status: 'PENDING',
        completedAt: null,
      })),
      observationIds: [],
      signalCode: null,
      eventCode: null,
      initiatedBy: null,
      startedAt: null,
      completedAt: null,
      reportAvailable: false,
      reportId: null,
      simulated: true,
    };
  }

  async report(scenarioCode: string) {
    if (!this.isScenarioCode(scenarioCode)) {
      throw new NotFoundException('Scénario de démonstration introuvable.');
    }
    const run = await this.repository.findScenario(scenarioCode);
    if (!run) {
      throw new NotFoundException(
        'Aucune exécution de ce scénario n’a été trouvée.',
      );
    }
    if (run.status !== 'COMPLETED' || !run.completedAt || !run.eventCode) {
      throw new ConflictException(
        'Le rapport sera disponible après une exécution complète du scénario.',
      );
    }

    const report =
      run.simulationReport ??
      buildScenarioSimulationReport(
        buildDynamicScenario(
          run.completedAt,
          this.configurationFromRun(run) ?? undefined,
        ),
        run.eventCode,
        run.completedAt,
      );
    return this.presentReport(report, run);
  }

  async run(user: PublicUser, dto: RunHubScenarioDto) {
    const now = new Date();
    const configuration = this.validateConfiguration(dto, now);
    const scenario = buildDynamicScenario(now, configuration);
    // Le seed idempotent restaure le socle régional sans dupliquer les fiches.
    const baseline = await this.demoSeedService.seed();
    await this.repository.startScenario({
      scenarioCode: scenario.scenarioCode,
      title: scenario.title,
      description: scenario.description,
      configuration,
      steps: scenario.steps,
      initiatedBy: user.id,
      startedAt: now,
    });

    try {
      await this.repository.upsertScenarioData(scenario);
      const event = await this.eventService.consolidate(
        scenario.observations.map((item) => item.canonicalId),
        user,
        scenario.scenarioCode,
      );
      const completedAt = new Date();
      const simulationReport = buildScenarioSimulationReport(
        scenario,
        event.eventCode,
        completedAt,
      );
      const run = await this.repository.completeScenario({
        scenarioCode: scenario.scenarioCode,
        observationIds: scenario.observations.map((item) => item.canonicalId),
        signalCode: scenario.signal.signalCode,
        eventCode: event.eventCode,
        simulationReport,
        completedAt,
      });
      const countries = [
        configuration.sourceCountryCode,
        configuration.comparisonCountryCode,
      ];
      await Promise.all([
        this.repository.createAudit({
          entityType: 'scenario',
          entityId: scenario.scenarioCode,
          action: 'SCENARIO_COMPLETED',
          actorId: user.id,
          actorType: 'USER',
          metadata: {
            observations: scenario.observations.length,
            signalCode: scenario.signal.signalCode,
            countries,
            configuration,
            eventCode: event.eventCode,
            reportId: simulationReport.reportId,
            baselineObservations: baseline.observations,
          },
          countryCode: configuration.sourceCountryCode,
          isDemo: true,
        }),
        this.repository.createAudit({
          entityType: 'signal',
          entityId: scenario.signal.signalCode,
          action: 'SIGNAL_CREATED_BY_SCENARIO',
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          metadata: {
            scenarioCode: scenario.scenarioCode,
            confidenceScore: scenario.signal.confidenceScore,
            configuration,
          },
          countryCode: configuration.sourceCountryCode,
          isDemo: true,
        }),
        this.repository.createAudit({
          entityType: 'report',
          entityId: simulationReport.reportId,
          action: 'SIMULATION_REPORT_GENERATED',
          actorId: user.id,
          actorType: 'USER',
          metadata: {
            scenarioCode: scenario.scenarioCode,
            eventCode: event.eventCode,
            signalCode: scenario.signal.signalCode,
            official: false,
            countries,
            configuration,
          },
          countryCode: configuration.sourceCountryCode,
          isDemo: true,
        }),
      ]);
      if (!run) throw new Error('Scenario run could not be completed');
      return this.present(run);
    } catch (error) {
      await this.repository.failScenario(scenario.scenarioCode);
      throw error;
    }
  }

  private present(run: HubScenarioRunDocument) {
    return {
      scenarioCode: run.scenarioCode,
      title: run.title,
      description: run.description,
      status: run.status,
      configuration:
        this.configurationFromRun(run) ??
        defaultHubScenarioConfiguration(run.startedAt),
      steps: run.steps.map((step) => ({
        code: step.code,
        label: step.label,
        status: step.status,
        completedAt: step.completedAt,
      })),
      observationIds: run.observationIds,
      signalCode: run.signalCode || null,
      eventCode: run.eventCode || null,
      initiatedBy: run.initiatedBy,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      reportAvailable: run.status === 'COMPLETED' && Boolean(run.eventCode),
      reportId:
        run.simulationReport?.reportId ??
        (run.status === 'COMPLETED' ? `SIM-${run.scenarioCode}` : null),
      simulated: run.isDemo,
    };
  }

  private presentReport(
    report: HubScenarioSimulationReport,
    run: HubScenarioRunDocument,
  ) {
    return {
      reportId: report.reportId,
      reportType: report.reportType,
      scenarioCode: run.scenarioCode,
      title: report.title,
      executiveSummary: report.executiveSummary,
      objective: report.objective,
      configuration:
        this.configurationFromRun(run) ??
        defaultHubScenarioConfiguration(run.completedAt ?? run.startedAt),
      countries: report.countries.map((country) => ({
        countryCode: country.countryCode,
        countryName: country.countryName,
      })),
      sectors: report.sectors,
      sourceSystems: report.sourceSystems,
      observationCount: report.observationCount,
      signalCount: report.signalCount,
      eventCount: report.eventCount,
      confidenceScore: report.confidenceScore,
      findings: report.findings,
      recommendations: report.recommendations,
      limitations: report.limitations,
      chronology: run.steps.map((step) => ({
        code: step.code,
        label: step.label,
        status: step.status,
        completedAt: step.completedAt,
      })),
      observationIds: report.observationIds,
      signalCode: report.signalCode,
      eventCode: report.eventCode,
      generatedAt: report.generatedAt,
      official: false,
      simulated: true,
    };
  }

  private validateConfiguration(
    dto: RunHubScenarioDto,
    now: Date,
  ): HubScenarioConfigurationSnapshot {
    if (dto.sourceCountryCode === dto.comparisonCountryCode) {
      throw new BadRequestException(
        'Le pays source et le pays comparé doivent être différents.',
      );
    }
    const dateFrom = this.parseDate(dto.dateFrom, 'dateFrom');
    const dateTo = this.parseDate(dto.dateTo, 'dateTo');
    if (dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException(
        'La date de début doit précéder ou égaler la date de fin.',
      );
    }
    const today = this.parseDate(this.dateInDouala(now), 'today');
    if (dateTo.getTime() > today.getTime()) {
      throw new BadRequestException(
        'La période du scénario ne peut pas se terminer dans le futur.',
      );
    }
    const days =
      Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1;
    if (days > 90) {
      throw new BadRequestException(
        'La période du scénario est limitée à 90 jours inclus.',
      );
    }

    return {
      sourceCountryCode: dto.sourceCountryCode,
      comparisonCountryCode: dto.comparisonCountryCode,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      sectors: HUB_SCENARIO_SECTORS,
      sourceSystems: HUB_SCENARIO_SOURCE_SYSTEMS,
      analysisType: HUB_SCENARIO_ANALYSIS_TYPE,
    };
  }

  private parseDate(value: string, field: string): Date {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        `${field} doit être une date valide au format YYYY-MM-DD.`,
      );
    }
    return parsed;
  }

  private dateInDouala(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private isScenarioCode(value: string): boolean {
    return (
      value === HUB_DYNAMIC_SCENARIO_CODE ||
      /^SCN-[A-Z]{2}-[A-Z]{2}-\d{8}-\d{8}$/.test(value)
    );
  }

  private configurationFromRun(
    run: HubScenarioRunDocument,
  ): HubScenarioConfigurationSnapshot | null {
    const configuration = run.configuration;
    if (!configuration) return null;
    return {
      sourceCountryCode:
        configuration.sourceCountryCode as HubScenarioConfigurationSnapshot['sourceCountryCode'],
      comparisonCountryCode:
        configuration.comparisonCountryCode as HubScenarioConfigurationSnapshot['comparisonCountryCode'],
      dateFrom: configuration.dateFrom,
      dateTo: configuration.dateTo,
      sectors: [...configuration.sectors],
      sourceSystems: [...configuration.sourceSystems],
      analysisType: HUB_SCENARIO_ANALYSIS_TYPE,
    };
  }
}
