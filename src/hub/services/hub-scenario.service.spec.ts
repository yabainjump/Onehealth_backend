import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';
import type { HubRepository } from '../repositories/hub.repository';
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
    type CompleteScenarioInput = {
      scenarioCode: string;
      observationIds: readonly string[];
      signalCode: string;
      eventCode: string;
      completedAt: Date;
    };
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
    const completedAudit = auditInputs.find(
      (input) => input.action === 'SCENARIO_COMPLETED',
    );
    expect(completedAudit).toBeDefined();
    expect(completedAudit?.metadata).toMatchObject({
      baselineObservations: 165,
    });
  });
});
