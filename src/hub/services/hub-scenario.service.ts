import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HUB_DYNAMIC_SCENARIO_CODE } from '../hub.constants';
import { HubRepository } from '../repositories/hub.repository';
import { buildDynamicScenario } from '../scenarios/hub-dynamic-scenario.factory';
import { buildScenarioSimulationReport } from '../scenarios/hub-scenario-report.factory';
import type {
  HubScenarioRunDocument,
  HubScenarioSimulationReport,
} from '../schemas/hub-scenario-run.schema';
import { HubEventService } from './hub-event.service';
import { HubDemoSeedService } from './hub-demo-seed.service';

@Injectable()
export class HubScenarioService {
  constructor(
    private readonly repository: HubRepository,
    private readonly eventService: HubEventService,
    private readonly demoSeedService: HubDemoSeedService,
  ) {}

  async current() {
    const run = await this.repository.findScenario(HUB_DYNAMIC_SCENARIO_CODE);
    if (run) return this.present(run);
    const scenario = buildDynamicScenario();
    return {
      scenarioCode: scenario.scenarioCode,
      title: scenario.title,
      description: scenario.description,
      status: 'READY',
      steps: scenario.steps.map((step) => ({
        ...step,
        status: 'PENDING',
        completedAt: null,
      })),
      observationIds: [],
      signalCode: null,
      initiatedBy: null,
      startedAt: null,
      completedAt: null,
      reportAvailable: false,
      reportId: null,
      simulated: true,
    };
  }

  async report(scenarioCode: string) {
    if (scenarioCode !== HUB_DYNAMIC_SCENARIO_CODE) {
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
        buildDynamicScenario(run.completedAt),
        run.eventCode,
        run.completedAt,
      );
    return this.presentReport(report, run);
  }

  async run(user: PublicUser) {
    const now = new Date();
    const scenario = buildDynamicScenario(now);
    // Le scénario s'appuie toujours sur le socle régional complet. Le seed est
    // idempotent : il restaure les fiches manquantes sans dupliquer celles qui
    // existent déjà, puis les quatre observations du scénario sont ajoutées.
    const baseline = await this.demoSeedService.seed();
    await this.repository.startScenario({
      scenarioCode: scenario.scenarioCode,
      title: scenario.title,
      description: scenario.description,
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
            countries: ['CM', 'TD'],
            eventCode: event.eventCode,
            reportId: simulationReport.reportId,
            baselineObservations: baseline.observations,
          },
          countryCode: 'CM',
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
          },
          countryCode: 'CM',
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
            countries: ['CM', 'TD'],
          },
          countryCode: 'CM',
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
}
