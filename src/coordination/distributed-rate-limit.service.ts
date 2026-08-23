import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CoordinationUnavailableError } from './coordination.errors';
import {
  RATE_LIMIT_POLICIES,
  RateLimitBucket,
  RateLimitPolicy,
} from './schemas/rate-limit-bucket.schema';
import { SubjectKeyService } from './subject-key.service';

const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_LIMIT = 1_000_000;

export type ConsumeRateLimitInput = {
  policy: RateLimitPolicy;
  subject: string;
  limit: number;
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

type BucketResult = Pick<
  RateLimitBucket,
  'count' | 'limitSnapshot' | 'resetAt'
>;

@Injectable()
export class DistributedRateLimitService {
  private readonly cleanupGraceMs: number;

  constructor(
    @InjectModel(RateLimitBucket.name)
    private readonly bucketModel: Model<RateLimitBucket>,
    configService: ConfigService,
    private readonly subjectKeys: SubjectKeyService,
  ) {
    this.cleanupGraceMs =
      configService.get<number>('rateLimitCleanupGraceMs') ?? 3_600_000;
  }

  async consume(
    input: ConsumeRateLimitInput,
    now = new Date(),
  ): Promise<RateLimitDecision> {
    this.validateInput(input, now);

    const nowMs = now.getTime();
    const windowStartedAtMs =
      Math.floor(nowMs / input.windowMs) * input.windowMs;
    const windowStartedAt = new Date(windowStartedAtMs);
    const resetAt = new Date(windowStartedAtMs + input.windowMs);
    const expiresAt = new Date(resetAt.getTime() + this.cleanupGraceMs);
    const subjectHash = this.subjectKeys.hash(input.policy, input.subject);
    const bucketId = this.subjectKeys.hash(
      'rate-limit-bucket',
      `${input.policy}:${subjectHash}:${windowStartedAtMs}`,
    );

    let bucket: BucketResult;
    try {
      bucket = await this.incrementWithUpsert({
        bucketId,
        policy: input.policy,
        subjectHash,
        windowStartedAt,
        resetAt,
        expiresAt,
        limit: input.limit,
      });
    } catch (error: unknown) {
      if (!this.isDuplicateKeyError(error)) {
        throw new CoordinationUnavailableError();
      }

      try {
        const racedBucket = await this.bucketModel
          .findOneAndUpdate(
            { _id: bucketId },
            { $inc: { count: 1 } },
            { new: true },
          )
          .lean<BucketResult>()
          .exec();
        if (!racedBucket) throw new CoordinationUnavailableError();
        bucket = racedBucket;
      } catch (retryError: unknown) {
        if (retryError instanceof CoordinationUnavailableError)
          throw retryError;
        throw new CoordinationUnavailableError();
      }
    }

    const allowed = bucket.count <= bucket.limitSnapshot;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt.getTime() - nowMs) / 1_000),
    );

    return {
      allowed,
      count: bucket.count,
      limit: bucket.limitSnapshot,
      remaining: Math.max(0, bucket.limitSnapshot - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds,
    };
  }

  private async incrementWithUpsert(input: {
    bucketId: string;
    policy: RateLimitPolicy;
    subjectHash: string;
    windowStartedAt: Date;
    resetAt: Date;
    expiresAt: Date;
    limit: number;
  }): Promise<BucketResult> {
    const bucket = await this.bucketModel
      .findOneAndUpdate(
        { _id: input.bucketId },
        {
          $setOnInsert: {
            policy: input.policy,
            subjectHash: input.subjectHash,
            windowStartedAt: input.windowStartedAt,
            resetAt: input.resetAt,
            limitSnapshot: input.limit,
            expiresAt: input.expiresAt,
          },
          $inc: { count: 1 },
        },
        { new: true, setDefaultsOnInsert: true, upsert: true },
      )
      .lean<BucketResult>()
      .exec();

    if (!bucket) throw new CoordinationUnavailableError();
    return bucket;
  }

  private validateInput(input: ConsumeRateLimitInput, now: Date): void {
    if (
      !RATE_LIMIT_POLICIES.includes(input.policy) ||
      !input.subject ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > MAX_LIMIT ||
      !Number.isInteger(input.windowMs) ||
      input.windowMs < 1_000 ||
      input.windowMs > MAX_WINDOW_MS ||
      !Number.isFinite(now.getTime())
    ) {
      throw new TypeError('Rate limit policy input is invalid.');
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
}
