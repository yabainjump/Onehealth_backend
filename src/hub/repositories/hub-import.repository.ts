import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { buildHubCountryFilter } from '../hub-access-scope';
import { HUB_CONNECTION, type HubSourceSystem } from '../hub.constants';
import type { HubImportCanonicalCandidate } from '../ingestion/hub-import.constants';
import {
  HubDataQualityIssue,
  type HubDataQualityIssueDocument,
} from '../schemas/hub-data-quality-issue.schema';
import {
  HubImportBatch,
  type HubImportBatchDocument,
} from '../schemas/hub-import-batch.schema';
import { HubIngestionRun } from '../schemas/hub-ingestion-run.schema';
import { HubObservation } from '../schemas/hub-observation.schema';
import { HubRawRecord } from '../schemas/hub-raw-record.schema';
import { HubSharingPolicy } from '../schemas/hub-sharing-policy.schema';

interface StoredCandidate extends Omit<
  HubImportCanonicalCandidate,
  'observedAt'
> {
  readonly observedAt: Date | string;
}

@Injectable()
export class HubImportRepository {
  constructor(
    @InjectModel(HubImportBatch.name, HUB_CONNECTION)
    private readonly batchModel: Model<HubImportBatch>,
    @InjectModel(HubDataQualityIssue.name, HUB_CONNECTION)
    private readonly qualityIssueModel: Model<HubDataQualityIssue>,
    @InjectModel(HubRawRecord.name, HUB_CONNECTION)
    private readonly rawRecordModel: Model<HubRawRecord>,
    @InjectModel(HubObservation.name, HUB_CONNECTION)
    private readonly observationModel: Model<HubObservation>,
    @InjectModel(HubSharingPolicy.name, HUB_CONNECTION)
    private readonly sharingPolicyModel: Model<HubSharingPolicy>,
    @InjectModel(HubIngestionRun.name, HUB_CONNECTION)
    private readonly ingestionRunModel: Model<HubIngestionRun>,
  ) {}

  async sharingPolicyExists(
    policyId: string,
    countryCode: string,
  ): Promise<boolean> {
    return Boolean(
      await this.sharingPolicyModel
        .exists({ policyId, countryOwner: countryCode, isDemo: true })
        .exec(),
    );
  }

  async existingSourceRecordIds(input: {
    sourceSystem: HubSourceSystem;
    sourceInstance: string;
    countryCode: string;
    sourceRecordIds: readonly string[];
  }): Promise<ReadonlySet<string>> {
    if (!input.sourceRecordIds.length) return new Set();
    const rows = await this.rawRecordModel
      .find({
        sourceSystem: input.sourceSystem,
        sourceInstance: input.sourceInstance,
        countryCode: input.countryCode,
        sourceRecordId: { $in: input.sourceRecordIds },
      })
      .select('sourceRecordId')
      .lean()
      .exec();
    return new Set(rows.map((row) => row.sourceRecordId));
  }

  async createPreview(input: {
    batch: Omit<
      HubImportBatch,
      'confirmedAt' | 'failureCode' | 'createdAt' | 'updatedAt'
    >;
    issues: readonly Omit<
      HubDataQualityIssue,
      'status' | 'createdAt' | 'updatedAt'
    >[];
  }): Promise<HubImportBatchDocument> {
    const batch = await this.batchModel.create({
      ...input.batch,
      confirmedAt: null,
      failureCode: '',
    });
    if (input.issues.length) {
      await this.qualityIssueModel.insertMany(
        input.issues.map((item) => ({ ...item, status: 'OPEN' })),
        { ordered: false },
      );
    }
    return batch;
  }

  async claimBatch(input: {
    batchId: string;
    actorId: string;
    allowedCountryCodes: readonly string[] | null;
  }): Promise<HubImportBatchDocument | null> {
    return this.batchModel
      .findOneAndUpdate(
        {
          batchId: input.batchId,
          actorId: input.actorId,
          status: { $in: ['PREVIEW', 'FAILED'] },
          expiresAt: { $gt: new Date() },
          ...buildHubCountryFilter(input.allowedCountryCodes),
        },
        { $set: { status: 'INGESTING', failureCode: '' } },
        { new: true, runValidators: true },
      )
      .select('+candidates')
      .exec();
  }

  async ingestClaimedBatch(batch: HubImportBatchDocument): Promise<{
    observationsCreated: number;
    duplicatesIgnored: number;
    rawRecordsCreated: number;
    runId: string;
  }> {
    const candidates =
      batch.candidates as unknown as readonly StoredCandidate[];
    const receivedAt = new Date();
    const scenarioId = `IMPORT-${batch.batchId}`;
    const rawResult = candidates.length
      ? await this.rawRecordModel.bulkWrite(
          candidates.map((candidate) => ({
            updateOne: {
              filter: {
                sourceSystem: batch.sourceSystem,
                sourceInstance: batch.sourceInstance,
                countryCode: batch.countryCode,
                sourceRecordId: candidate.sourceRecordId,
              },
              update: {
                $setOnInsert: {
                  sourceSystem: batch.sourceSystem,
                  sourceInstance: batch.sourceInstance,
                  sourceRecordId: candidate.sourceRecordId,
                  countryCode: batch.countryCode,
                  payload: candidate.canonicalPayload,
                  checksum: candidate.checksum,
                  schemaVersion: batch.mappingVersion,
                  receivedAt,
                  ingestionRunId: batch.batchId,
                  sharingPolicyId: batch.sharingPolicyId,
                  isDemo: true,
                  scenarioId,
                },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        )
      : null;
    const observationResult = candidates.length
      ? await this.observationModel.bulkWrite(
          candidates.map((candidate) => ({
            updateOne: {
              filter: { canonicalId: candidate.canonicalId },
              update: {
                $setOnInsert: {
                  canonicalId: candidate.canonicalId,
                  sourceSystem: batch.sourceSystem,
                  sourceInstance: batch.sourceInstance,
                  sourceRecordId: candidate.sourceRecordId,
                  sector: candidate.sector,
                  countryCode: candidate.countryCode,
                  countryName: candidate.countryName,
                  adminArea: candidate.adminArea,
                  location: {
                    type: 'Point',
                    coordinates: [candidate.longitude, candidate.latitude],
                  },
                  observedAt: new Date(candidate.observedAt),
                  receivedAt,
                  category: candidate.category,
                  title: candidate.title,
                  summary: candidate.summary,
                  stage: 'observation',
                  severity: candidate.severity,
                  metrics: candidate.metrics.map((metric) => ({ ...metric })),
                  sharingPolicyId: batch.sharingPolicyId,
                  isDemo: true,
                  scenarioId,
                  eventCode: '',
                },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        )
      : null;

    const observationsCreated = observationResult?.upsertedCount ?? 0;
    const rawRecordsCreated = rawResult?.upsertedCount ?? 0;
    const duplicatesIgnored = candidates.length - observationsCreated;
    const runId = `RUN-FILE-${randomUUID()}`;
    await this.ingestionRunModel.create({
      runId,
      connectorId: `FILE-${batch.sourceSystem.replace(/\s/g, '-')}-${batch.countryCode}`,
      countryCode: batch.countryCode,
      status: 'SUCCESS',
      startedAt: batch.updatedAt ?? receivedAt,
      completedAt: receivedAt,
      recordsReceived: batch.totalRecords,
      recordsAccepted: observationsCreated,
      recordsRejected: batch.rejectedRecords,
      duplicateRecords: batch.duplicateRecords + duplicatesIgnored,
      durationMs: Math.max(
        0,
        receivedAt.getTime() -
          (batch.updatedAt?.getTime() ?? receivedAt.getTime()),
      ),
      triggeredBy: 'USER',
      actorId: batch.actorId,
      errorCode: '',
      isDemo: true,
    });
    return { observationsCreated, duplicatesIgnored, rawRecordsCreated, runId };
  }

  completeBatch(batchId: string): Promise<HubImportBatchDocument | null> {
    return this.batchModel
      .findOneAndUpdate(
        { batchId, status: 'INGESTING' },
        {
          $set: {
            status: 'COMPLETED',
            confirmedAt: new Date(),
            failureCode: '',
          },
        },
        { new: true },
      )
      .exec();
  }

  failBatch(
    batchId: string,
    failureCode: string,
  ): Promise<HubImportBatchDocument | null> {
    return this.batchModel
      .findOneAndUpdate(
        { batchId, status: 'INGESTING' },
        { $set: { status: 'FAILED', failureCode } },
        { new: true },
      )
      .exec();
  }

  async listBatches(input: {
    allowedCountryCodes: readonly string[] | null;
    page: number;
    limit: number;
  }) {
    const filter = buildHubCountryFilter(input.allowedCountryCodes);
    const [items, total] = await Promise.all([
      this.batchModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((input.page - 1) * input.limit)
        .limit(input.limit)
        .lean()
        .exec(),
      this.batchModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async listQualityIssues(input: {
    allowedCountryCodes: readonly string[] | null;
    countryCode?: string;
    sourceSystem?: HubSourceSystem;
    status?: 'OPEN' | 'RESOLVED' | 'DISMISSED';
    page: number;
    limit: number;
  }): Promise<{ items: HubDataQualityIssueDocument[]; total: number }> {
    const filter: Record<string, unknown> = buildHubCountryFilter(
      input.allowedCountryCodes,
      input.countryCode,
    );
    if (input.sourceSystem) filter.sourceSystem = input.sourceSystem;
    if (input.status) filter.status = input.status;
    const [items, total] = await Promise.all([
      this.qualityIssueModel
        .find(filter)
        .sort({ createdAt: -1, issueId: 1 })
        .skip((input.page - 1) * input.limit)
        .limit(input.limit)
        .exec(),
      this.qualityIssueModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
