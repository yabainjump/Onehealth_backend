import { Injectable } from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HUB_DYNAMIC_SCENARIO_CODE } from '../hub.constants';
import { HubRepository } from '../repositories/hub.repository';
import { buildDynamicScenario } from '../scenarios/hub-dynamic-scenario.factory';
import type { HubScenarioRunDocument } from '../schemas/hub-scenario-run.schema';

@Injectable()
export class HubScenarioService {
  constructor(private readonly repository: HubRepository) {}

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
      simulated: true,
    };
  }

  async run(user: PublicUser) {
    const now = new Date();
    const scenario = buildDynamicScenario(now);
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
      const completedAt = new Date();
      const run = await this.repository.completeScenario({
        scenarioCode: scenario.scenarioCode,
        observationIds: scenario.observations.map((item) => item.canonicalId),
        signalCode: scenario.signal.signalCode,
        completedAt,
      });
      await Promise.all([
        this.repository.createAudit({
          auditKey: `${scenario.scenarioCode}-RUN`,
          entityType: 'scenario',
          entityId: scenario.scenarioCode,
          action: 'SCENARIO_COMPLETED',
          actorId: user.id,
          actorType: 'USER',
          metadata: {
            observations: scenario.observations.length,
            signalCode: scenario.signal.signalCode,
            countries: ['CM', 'TD'],
          },
          countryCode: 'CM',
          isDemo: true,
        }),
        this.repository.createAudit({
          auditKey: `${scenario.scenarioCode}-SIGNAL`,
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
      initiatedBy: run.initiatedBy,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      simulated: run.isDemo,
    };
  }
}
