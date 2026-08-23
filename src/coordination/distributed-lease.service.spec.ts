import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import {
  CoordinationUnavailableError,
  LeaseBusyError,
} from './coordination.errors';
import { DistributedLeaseService } from './distributed-lease.service';
import { DistributedLease } from './schemas/distributed-lease.schema';
import { SubjectKeyService } from './subject-key.service';

const updateQuery = <T>(value: T, reject = false) => ({
  lean: () => ({
    exec: reject
      ? jest.fn().mockRejectedValue(value)
      : jest.fn().mockResolvedValue(value),
  }),
});

describe('DistributedLeaseService', () => {
  let model: {
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
  };
  let service: DistributedLeaseService;

  beforeEach(() => {
    model = {
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
    };
    const values: Record<string, string | number> = {
      distributedLeaseTtlMs: 75_000,
      distributedLeaseAcquireTimeoutMs: 0,
      distributedLeaseRetryMs: 25,
      instanceId: 'worker-1',
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    const subjectKeys = new SubjectKeyService({
      get: jest.fn().mockReturnValue('k'.repeat(64)),
    } as unknown as ConfigService);
    service = new DistributedLeaseService(
      model as unknown as Model<DistributedLease>,
      config,
      subjectKeys,
    );
  });

  it('returns exclusive ownership and never persists the raw resource', async () => {
    model.findOneAndUpdate.mockImplementation(
      (_filter: unknown, update: unknown) => {
        const typedUpdate = update as {
          $set: { expiresAt: Date; ownerToken: string };
        };
        return updateQuery({
          _id: 'lease-id',
          ownerToken: typedUpdate.$set.ownerToken,
          expiresAt: typedUpdate.$set.expiresAt,
        });
      },
    );

    const lease = await service.acquire({
      namespace: 'rudolf-conversation',
      resource: 'user-id:conversation-id',
    });

    expect(lease.ownerToken).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(model.findOneAndUpdate.mock.calls)).not.toContain(
      'user-id:conversation-id',
    );
  });

  it('reports deterministic contention when another owner holds the lease', async () => {
    model.findOneAndUpdate.mockReturnValue(updateQuery({ code: 11000 }, true));

    await expect(
      service.acquire({
        namespace: 'rudolf-conversation',
        resource: 'conversation',
      }),
    ).rejects.toBeInstanceOf(LeaseBusyError);
  });

  it('releases only with the current owner token', async () => {
    model.deleteOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    });

    const released = await service.release({
      key: 'lease-id',
      ownerToken: 'stale-owner',
      expiresAt: new Date(),
    });

    expect(released).toBe(false);
    expect(model.deleteOne).toHaveBeenCalledWith({
      _id: 'lease-id',
      ownerToken: 'stale-owner',
    });
  });

  it('allows an expired record to be atomically replaced', async () => {
    model.findOneAndUpdate.mockImplementation(
      (filter: unknown, update: unknown) => {
        const typedFilter = filter as {
          $or: Array<Record<string, unknown>>;
        };
        const typedUpdate = update as {
          $set: { expiresAt: Date; ownerToken: string };
        };
        const expiryFilter = typedFilter.$or[0] as {
          expiresAt: { $lte: unknown };
        };
        expect(expiryFilter.expiresAt.$lte).toBeInstanceOf(Date);
        expect(typedFilter.$or[1]).toEqual({
          expiresAt: { $exists: false },
        });
        return updateQuery({
          _id: 'lease-id',
          ownerToken: typedUpdate.$set.ownerToken,
          expiresAt: typedUpdate.$set.expiresAt,
        });
      },
    );

    const acquired = await service.acquire({
      namespace: 'rudolf-conversation',
      resource: 'conversation',
    });

    expect(acquired.key).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns a typed unavailable error for storage failures', async () => {
    model.findOneAndUpdate.mockReturnValue(
      updateQuery(new Error('database unavailable'), true),
    );

    await expect(
      service.acquire({
        namespace: 'rudolf-conversation',
        resource: 'conversation',
      }),
    ).rejects.toBeInstanceOf(CoordinationUnavailableError);
  });
});
