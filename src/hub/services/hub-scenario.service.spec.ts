import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';
import type { HubRepository } from '../repositories/hub.repository';
import { buildDynamicScenario } from '../scenarios/hub-dynamic-scenario.factory';
import { buildScenarioSimulationReport } from '../scenarios/hub-scenario-report.factory';
import type { HubScenarioRunDocument } from '../schemas/hub-scenario-run.schema';
import type { HubDemoSeedService } from './hub-demo-seed.service';
import type { HubEventService } from './hub-event.service';
import { HubScenarioService } from './hub-scenario.service';

const admin = {
  id: '507f1f77bcf86cd799439011',
  role: UserRole.ADMIN,
  hubRoles: [HubRole.ADMIN],
  hubCountryCodes: [],
} as PublicUser;

describe('HubScenarioService', () => {
  it('restores the 165-record baseline before adding the dynamic scenario', async () => {
    type CompleteScenarioInput = Parameters<
      HubRepository['completeScenario']
    >[0];
    type AuditInput = Parameters<HubRepository['createAudit']>[0];

    const startScenario = jest.fn(() => Promise.resolve({}));
    const upsertScenarioData = jest.fn(() => Promise.resolve());
    const completeScenario = jest.fn((input: CompleteScenarioInput) =>
      Promise.resolve({
        scenarioCode: input.scenarioCode,
        title: 'Convergence zoonotique Cameroun–Tchad',
        description: 'Scenario test',
        status: 'COMPLETED',
        steps: Array.from({ length: 6 }, (_, index) => ({
          code: `STEP-${index}`,
          label: `Étape ${index}`,
          status: 'COMPLETED',
          completedAt: input.completedAt,
        })),
        observationIds: input.observationIds,
        signalCode: input.signalCode,
        eventCode: input.eventCode,
        simulationReport: input.simulationReport,
        initiatedBy: admin.id,
        startedAt: input.completedAt,
        completedAt: input.completedAt,
        isDemo: true,
      } as HubScenarioRunDocument),
    );
    const auditInputs: AuditInput[] = [];
    const createAudit = jest.fn((input: AuditInput) => {
      auditInputs.push(input);
      return Promise.resolve({});
    });
    const repository = {
      startScenario,
      upsertScenarioData,
      completeScenario,
      createAudit,
      failScenario: jest.fn(),
    } as unknown as HubRepository;

    const consolidate = jest.fn(() =>
      Promise.resolve({
        eventCode: 'EVT-CM-TD-TEST0001',
      } as Awaited<ReturnType<HubEventService['consolidate']>>),
    );
    const eventService = { consolidate } as HubEventService;

    const seed = jest.fn(() =>
      Promise.resolve({ observations: 165 } as Awaited<
        ReturnType<HubDemoSeedService['seed']>
      >),
    );
    const seedService = { seed } as HubDemoSeedService;
    const service = new HubScenarioService(
      repository,
      eventService,
      seedService,
    );

    const result = await service.run(admin);

    expect(seed).toHaveBeenCalledTimes(1);
    expect(upsertScenarioData).toHaveBeenCalledTimes(1);
    expect(seed.mock.invocationCallOrder[0]).toBeLessThan(
      upsertScenarioData.mock.invocationCallOrder[0],
    );
    expect(result.observationIds).toHaveLength(4);
    expect(result.eventCode).toBe('EVT-CM-TD-TEST0001');
    expect(result.reportAvailable).toBe(true);
    expect(result.reportId).toBe('SIM-SCN-CM-TD-CONVERGENCE-01');
    const completedAudit = auditInputs.find(
      (input) => input.action === 'SCENARIO_COMPLETED',
    );
    expect(completedAudit).toBeDefined();
    expect(completedAudit?.metadata).toMatchObject({
      baselineObservations: 165,
      reportId: 'SIM-SCN-CM-TD-CONVERGENCE-01',
    });
    expect(
      auditInputs.some(
        (input) => input.action === 'SIMULATION_REPORT_GENERATED',
      ),
    ).toBe(true);
  });

  it('returns the completed simulation report without making it official', async () => {
    const completedAt = new Date('2026-09-23T10:00:00.000Z');
    const scenario = buildDynamicScenario(completedAt);
    const simulationReport = buildScenarioSimulationReport(
      scenario,
      'EVT-CM-TD-TEST0001',
      completedAt,
    );
    const run = {
      scenarioCode: scenario.scenarioCode,
      title: scenario.title,
      description: scenario.description,
      status: 'COMPLETED',
      steps: scenario.steps.map((step) => ({
        ...step,
        status: 'COMPLETED',
        completedAt,
      })),
      observationIds: simulationReport.observationIds,
      signalCode: simulationReport.signalCode,
      eventCode: simulationReport.eventCode,
      simulationReport,
      initiatedBy: admin.id,
      startedAt: completedAt,
      completedAt,
      isDemo: true,
    } as HubScenarioRunDocument;
    const repository = {
      findScenario: jest.fn(() => Promise.resolve(run)),
    } as unknown as HubRepository;
    const service = new HubScenarioService(
      repository,
      {} as HubEventService,
      {} as HubDemoSeedService,
    );

    const result = await service.report(scenario.scenarioCode);

    expect(result.reportType).toBe('SIMULATION');
    expect(result.official).toBe(false);
    expect(result.simulated).toBe(true);
    expect(result.observationCount).toBe(4);
    expect(result.chronology).toHaveLength(6);
    expect(result.eventCode).toBe('EVT-CM-TD-TEST0001');
  });

  it('refuses a report while the scenario is not completed', async () => {
    const repository = {
      findScenario: jest.fn(() =>
        Promise.resolve({
          status: 'RUNNING',
          completedAt: null,
          eventCode: '',
        } as HubScenarioRunDocument),
      ),
    } as unknown as HubRepository;
    const service = new HubScenarioService(
      repository,
      {} as HubEventService,
      {} as HubDemoSeedService,
    );

    await expect(
      service.report('SCN-CM-TD-CONVERGENCE-01'),
    ).rejects.toMatchObject({ status: 409 });
  });
});
