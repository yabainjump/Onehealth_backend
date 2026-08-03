import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';
import type { HubRepository } from '../repositories/hub.repository';
import type { HubScenarioRunDocument } from '../schemas/hub-scenario-run.schema';
import { HubScenarioService } from './hub-scenario.service';

const admin = {
  id: '507f1f77bcf86cd799439011',
  role: UserRole.ADMIN,
  hubRoles: [HubRole.ADMIN],
  hubCountryCodes: [],
} as PublicUser;

describe('HubScenarioService', () => {
  it('restores the 165-record baseline before adding the dynamic scenario', async () => {
    const repository = {
      startScenario: jest.fn().mockResolvedValue({}),
      upsertScenarioData: jest.fn().mockResolvedValue(undefined),
      completeScenario: jest.fn().mockImplementation(
        async (input) =>
          ({
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
          }) as HubScenarioRunDocument,
      ),
      createAudit: jest.fn().mockResolvedValue({}),
      failScenario: jest.fn(),
    } as unknown as jest.Mocked<HubRepository>;
    const eventService = {
      consolidate: jest
        .fn()
        .mockResolvedValue({ eventCode: 'EVT-CM-TD-TEST0001' }),
    };
    const seedService = {
      seed: jest.fn().mockResolvedValue({ observations: 165 }),
    };
    const service = new HubScenarioService(
      repository,
      eventService as never,
      seedService as never,
    );

    const result = await service.run(admin);

    expect(seedService.seed).toHaveBeenCalledTimes(1);
    expect(repository.upsertScenarioData).toHaveBeenCalledTimes(1);
    expect(seedService.seed.mock.invocationCallOrder[0]).toBeLessThan(
      repository.upsertScenarioData.mock.invocationCallOrder[0],
    );
    expect(result.observationIds).toHaveLength(4);
    expect(result.eventCode).toBe('EVT-CM-TD-TEST0001');
    expect(repository.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SCENARIO_COMPLETED',
        metadata: expect.objectContaining({ baselineObservations: 165 }),
      }),
    );
  });
});
