import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DistributedLeaseService } from './distributed-lease.service';
import { DistributedRateLimitService } from './distributed-rate-limit.service';
import {
  DistributedLease,
  DistributedLeaseSchema,
} from './schemas/distributed-lease.schema';
import {
  RateLimitBucket,
  RateLimitBucketSchema,
} from './schemas/rate-limit-bucket.schema';
import { SubjectKeyService } from './subject-key.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RateLimitBucket.name, schema: RateLimitBucketSchema },
      { name: DistributedLease.name, schema: DistributedLeaseSchema },
    ]),
  ],
  providers: [
    SubjectKeyService,
    DistributedRateLimitService,
    DistributedLeaseService,
  ],
  exports: [
    SubjectKeyService,
    DistributedRateLimitService,
    DistributedLeaseService,
  ],
})
export class CoordinationModule {}
