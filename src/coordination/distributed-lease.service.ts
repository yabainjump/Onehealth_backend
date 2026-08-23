import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import {
  CoordinationUnavailableError,
  LeaseBusyError,
} from './coordination.errors';
import {
  DistributedLease,
  LEASE_NAMESPACES,
  LeaseNamespace,
} from './schemas/distributed-lease.schema';
import { SubjectKeyService } from './subject-key.service';

export type AcquireLeaseInput = {
  namespace: LeaseNamespace;
  resource: string;
  ttlMs?: number;
  waitMs?: number;
};

export type LeaseHandle = {
  key: string;
  ownerToken: string;
  expiresAt: Date;
};

type LeaseResult = Pick<DistributedLease, '_id' | 'ownerToken' | 'expiresAt'>;

@Injectable()
export class DistributedLeaseService {
  private readonly defaultTtlMs: number;
  private readonly defaultWaitMs: number;
  private readonly retryMs: number;
  private readonly instanceId: string;

  constructor(
    @InjectModel(DistributedLease.name)
    private readonly leaseModel: Model<DistributedLease>,
    configService: ConfigService,
    private readonly subjectKeys: SubjectKeyService,
  ) {
    this.defaultTtlMs =
      configService.get<number>('distributedLeaseTtlMs') ?? 75_000;
    this.defaultWaitMs =
      configService.get<number>('distributedLeaseAcquireTimeoutMs') ?? 1_500;
    this.retryMs = configService.get<number>('distributedLeaseRetryMs') ?? 75;
    this.instanceId =
      configService.get<string>('instanceId') ?? `process-${process.pid}`;
  }

  async acquire(input: AcquireLeaseInput): Promise<LeaseHandle> {
    this.validateInput(input);
    const ttlMs = input.ttlMs ?? this.defaultTtlMs;
    const waitMs = input.waitMs ?? this.defaultWaitMs;
    const resourceHash = this.subjectKeys.hash(input.namespace, input.resource);
    const key = this.subjectKeys.hash(
      'distributed-lease',
      `${input.namespace}:${resourceHash}`,
    );
    const deadline = Date.now() + waitMs;

    do {
      const lease = await this.tryAcquire(
        key,
        input.namespace,
        resourceHash,
        ttlMs,
      );
      if (lease) return lease;
      if (Date.now() >= deadline) break;
      await this.sleep(
        Math.min(this.retryMs, Math.max(1, deadline - Date.now())),
      );
    } while (Date.now() <= deadline);

    throw new LeaseBusyError(Math.max(1, Math.ceil(ttlMs / 1_000)));
  }

  async release(lease: LeaseHandle): Promise<boolean> {
    try {
      const result = await this.leaseModel
        .deleteOne({ _id: lease.key, ownerToken: lease.ownerToken })
        .exec();
      return result.deletedCount === 1;
    } catch {
      throw new CoordinationUnavailableError();
    }
  }

  private async tryAcquire(
    key: string,
    namespace: LeaseNamespace,
    resourceHash: string,
    ttlMs: number,
  ): Promise<LeaseHandle | null> {
    const acquiredAt = new Date();
    const expiresAt = new Date(acquiredAt.getTime() + ttlMs);
    const ownerToken = randomBytes(32).toString('hex');

    try {
      const lease = await this.leaseModel
        .findOneAndUpdate(
          {
            _id: key,
            $or: [
              { expiresAt: { $lte: acquiredAt } },
              { expiresAt: { $exists: false } },
            ],
          },
          {
            $set: {
              namespace,
              resourceHash,
              ownerToken,
              instanceId: this.instanceId,
              acquiredAt,
              expiresAt,
            },
          },
          { new: true, setDefaultsOnInsert: true, upsert: true },
        )
        .lean<LeaseResult>()
        .exec();

      if (!lease || lease.ownerToken !== ownerToken) return null;
      return { key, ownerToken, expiresAt: lease.expiresAt };
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) return null;
      throw new CoordinationUnavailableError();
    }
  }

  private validateInput(input: AcquireLeaseInput): void {
    const ttlMs = input.ttlMs ?? this.defaultTtlMs;
    const waitMs = input.waitMs ?? this.defaultWaitMs;
    if (
      !LEASE_NAMESPACES.includes(input.namespace) ||
      !input.resource ||
      input.resource.length > 4_096 ||
      !Number.isInteger(ttlMs) ||
      ttlMs < 10_000 ||
      ttlMs > 300_000 ||
      !Number.isInteger(waitMs) ||
      waitMs < 0 ||
      waitMs > 10_000
    ) {
      throw new TypeError('Distributed lease input is invalid.');
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  private sleep(durationMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
  }
}
