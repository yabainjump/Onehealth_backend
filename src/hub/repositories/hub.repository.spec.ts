import type { Model } from 'mongoose';
import { HubRepository } from './hub.repository';
import type { HubAuditLog } from '../schemas/hub-audit-log.schema';

describe('HubRepository audit persistence', () => {
  it('omits auditKey when no idempotency key is provided', async () => {
    const auditModel = { create: jest.fn().mockResolvedValue({}) };
    const unusedModel = {} as never;
    const repository = new HubRepository(
      unusedModel,
      unusedModel,
      unusedModel,
      unusedModel,
      auditModel as unknown as Model<HubAuditLog>,
      unusedModel,
      unusedModel,
      unusedModel,
      unusedModel,
    );

    await repository.createAudit({
      entityType: 'scenario',
      entityId: 'SCN-CM-TD-CONVERGENCE-01',
      action: 'SCENARIO_COMPLETED',
      actorId: 'SYSTEM',
      actorType: 'SYSTEM',
      countryCode: 'CM',
      isDemo: true,
    });

    expect(auditModel.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ auditKey: expect.anything() }),
    );
  });
});
