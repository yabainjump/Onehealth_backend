import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HubObservationStage,
  HubSector,
  HUB_CONNECTION,
} from '../hub.constants';
import { buildHubCountryFilter } from '../hub-access-scope';
import {
  HubDemoAlertSeed,
  HubDemoObservationSeed,
  HubDemoRawSeed,
  HubDemoSharingPolicySeed,
  HubDemoSignalSeed,
} from '../seeds/hub-demo-data.factory';
import { HubAlert, HubAlertDocument } from '../schemas/hub-alert.schema';
import { HubAuditLog } from '../schemas/hub-audit-log.schema';
import {
  HubObservation,
  HubObservationDocument,
} from '../schemas/hub-observation.schema';
import { HubRawRecord } from '../schemas/hub-raw-record.schema';
import { HubSharingPolicy } from '../schemas/hub-sharing-policy.schema';
import { HubSignal, HubSignalDocument } from '../schemas/hub-signal.schema';

export interface HubObservationListFilter {
  readonly search?: string;
  readonly countryCode?: string;
  readonly sector?: HubSector;
  readonly stage?: HubObservationStage;
  readonly allowedCountryCodes: readonly string[] | null;
  readonly page: number;
  readonly limit: number;
}

export interface HubAuditInput {
  readonly auditKey?: string;
  readonly entityType:
    | 'observation'
    | 'signal'
    | 'alert'
    | 'connector'
    | 'seed';
  readonly entityId: string;
  readonly action: string;
  readonly actorId: string;
  readonly actorType: 'USER' | 'SYSTEM';
  readonly metadata?: Record<string, unknown>;
  readonly countryCode: string;
  readonly isDemo: boolean;
}

@Injectable()
export class HubRepository {
  constructor(
    @InjectModel(HubRawRecord.name, HUB_CONNECTION)
    private readonly rawRecordModel: Model<HubRawRecord>,
    @InjectModel(HubObservation.name, HUB_CONNECTION)
    private readonly observationModel: Model<HubObservation>,
    @InjectModel(HubSignal.name, HUB_CONNECTION)
    private readonly signalModel: Model<HubSignal>,
    @InjectModel(HubAlert.name, HUB_CONNECTION)
    private readonly alertModel: Model<HubAlert>,
    @InjectModel(HubAuditLog.name, HUB_CONNECTION)
    private readonly auditLogModel: Model<HubAuditLog>,
    @InjectModel(HubSharingPolicy.name, HUB_CONNECTION)
    private readonly sharingPolicyModel: Model<HubSharingPolicy>,
  ) {}

  async listObservations(filter: HubObservationListFilter): Promise<{
    items: HubObservationDocument[];
    total: number;
  }> {
    const mongoFilter = buildHubCountryFilter(
      filter.allowedCountryCodes,
      filter.countryCode,
    );
    if (filter.sector) mongoFilter.sector = filter.sector;
    if (filter.stage) mongoFilter.stage = filter.stage;

    const search = filter.search?.trim();
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safeSearch, 'i');
      mongoFilter.$or = [
        { canonicalId: regex },
        { sourceRecordId: regex },
        { title: regex },
        { countryName: regex },
        { adminArea: regex },
      ];
    }

    const [items, total] = await Promise.all([
      this.observationModel
        .find(mongoFilter)
        .sort({ observedAt: -1, canonicalId: 1 })
        .skip((filter.page - 1) * filter.limit)
        .limit(filter.limit)
        .exec(),
      this.observationModel.countDocuments(mongoFilter).exec(),
    ]);
    return { items, total };
  }

  async summary(allowedCountryCodes: readonly string[] | null) {
    const baseFilter = this.observationFilter(allowedCountryCodes);
    const [
      total,
      countries,
      human,
      animal,
      environment,
      observations,
      signals,
      alerts,
    ] = await Promise.all([
      this.observationModel.countDocuments(baseFilter).exec(),
      this.observationModel.distinct('countryCode', baseFilter).exec(),
      this.observationModel
        .countDocuments({ ...baseFilter, sector: 'human' })
        .exec(),
      this.observationModel
        .countDocuments({ ...baseFilter, sector: 'animal' })
        .exec(),
      this.observationModel
        .countDocuments({ ...baseFilter, sector: 'environment' })
        .exec(),
      this.observationModel
        .countDocuments({ ...baseFilter, stage: 'observation' })
        .exec(),
      this.observationModel
        .countDocuments({ ...baseFilter, stage: 'signal' })
        .exec(),
      this.observationModel
        .countDocuments({ ...baseFilter, stage: 'verified-alert' })
        .exec(),
    ]);

    return {
      total,
      countries: countries.length,
      bySector: { human, animal, environment },
      byStage: {
        observation: observations,
        signal: signals,
        'verified-alert': alerts,
      },
    };
  }

  findObservation(
    canonicalId: string,
    allowedCountryCodes: readonly string[] | null,
  ): Promise<HubObservationDocument | null> {
    return this.observationModel
      .findOne({
        ...this.observationFilter(allowedCountryCodes),
        canonicalId,
      })
      .exec();
  }

  relatedObservations(
    reference: HubObservationDocument,
    allowedCountryCodes: readonly string[] | null,
    limit = 6,
  ): Promise<HubObservationDocument[]> {
    return this.observationModel
      .find({
        ...this.observationFilter(allowedCountryCodes),
        canonicalId: { $ne: reference.canonicalId },
        countryCode: reference.countryCode,
      })
      .sort({ observedAt: -1 })
      .limit(limit)
      .exec();
  }

  findSignalByObservation(
    observationId: string,
  ): Promise<HubSignalDocument | null> {
    return this.signalModel.findOne({ observationId }).exec();
  }

  findAlertByObservation(
    observationId: string,
  ): Promise<HubAlertDocument | null> {
    return this.alertModel.findOne({ observationId }).exec();
  }

  async listAudit(entityId: string, countryCode: string) {
    return this.auditLogModel
      .find({ entityId, countryCode })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
  }

  assignSignal(
    signalCode: string,
    actorId: string,
    countryCodes: readonly string[] | null,
  ) {
    const filter: Record<string, unknown> = {
      signalCode,
      status: 'SIGNAL_DETECTED',
    };
    if (countryCodes) filter.countryCode = { $in: countryCodes };

    return this.signalModel
      .findOneAndUpdate(
        filter,
        {
          $set: {
            assignedTo: new Types.ObjectId(actorId),
            status: 'UNDER_VERIFICATION',
            reviewStartedAt: new Date(),
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
  }

  decideSignal(
    signalCode: string,
    actorId: string,
    status: 'VERIFIED' | 'REJECTED',
    note: string,
    countryCodes: readonly string[] | null,
  ) {
    const filter: Record<string, unknown> = {
      signalCode,
      status: 'UNDER_VERIFICATION',
      assignedTo: new Types.ObjectId(actorId),
    };
    if (countryCodes) filter.countryCode = { $in: countryCodes };

    return this.signalModel
      .findOneAndUpdate(
        filter,
        {
          $set: {
            status,
            decisionNote: note,
            decidedAt: new Date(),
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
  }

  updateObservationStage(
    canonicalId: string,
    stage: HubObservationStage,
    severity?: 'critical',
  ) {
    const set: Record<string, unknown> = { stage };
    if (severity) set.severity = severity;
    return this.observationModel
      .findOneAndUpdate({ canonicalId }, { $set: set }, { new: true })
      .exec();
  }

  upsertVerifiedAlert(
    signal: HubSignalDocument,
    observation: HubObservationDocument,
    actorId: string,
    note: string,
  ) {
    return this.alertModel
      .findOneAndUpdate(
        { signalCode: signal.signalCode },
        {
          $setOnInsert: {
            alertCode: `ALT-${observation.sourceRecordId}`,
            signalCode: signal.signalCode,
            observationId: observation.canonicalId,
            title: observation.title,
            summary: observation.summary,
            riskLevel: 'critical',
            countryCode: observation.countryCode,
            status: 'VERIFIED',
            verifiedBy: actorId,
            verifiedAt: signal.decidedAt ?? new Date(),
            verificationNote: note,
            sharingPolicyId: observation.sharingPolicyId,
            isDemo: observation.isDemo,
          },
        },
        { upsert: true, new: true, runValidators: true },
      )
      .exec();
  }

  createAudit(input: HubAuditInput) {
    return this.auditLogModel.create({
      auditKey: input.auditKey ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      actorType: input.actorType,
      metadata: input.metadata ?? {},
      countryCode: input.countryCode,
      isDemo: input.isDemo,
    });
  }

  async seedDemo(data: {
    rawRecords: readonly HubDemoRawSeed[];
    observations: readonly HubDemoObservationSeed[];
    signals: readonly HubDemoSignalSeed[];
    alerts: readonly HubDemoAlertSeed[];
    sharingPolicies: readonly HubDemoSharingPolicySeed[];
  }) {
    await Promise.all([
      this.bulkInsertOnly(this.rawRecordModel, data.rawRecords, (record) => ({
        sourceSystem: record.sourceSystem,
        sourceInstance: record.sourceInstance,
        countryCode: record.countryCode,
        sourceRecordId: record.sourceRecordId,
      })),
      this.bulkInsertOnly(
        this.observationModel,
        data.observations,
        (record) => ({
          canonicalId: record.canonicalId,
        }),
      ),
      this.bulkInsertOnly(this.signalModel, data.signals, (record) => ({
        signalCode: record.signalCode,
      })),
      this.bulkInsertOnly(this.alertModel, data.alerts, (record) => ({
        alertCode: record.alertCode,
      })),
      this.bulkInsertOnly(
        this.sharingPolicyModel,
        data.sharingPolicies,
        (record) => ({ policyId: record.policyId }),
      ),
    ]);

    await this.auditLogModel
      .updateOne(
        { auditKey: 'DEMO-SEED-2026-08-02' },
        {
          $setOnInsert: {
            auditKey: 'DEMO-SEED-2026-08-02',
            entityType: 'seed',
            entityId: 'CEEAC-DEMO-2026',
            action: 'DEMO_DATA_SEEDED',
            actorId: 'SYSTEM',
            actorType: 'SYSTEM',
            metadata: {
              rawRecords: data.rawRecords.length,
              observations: data.observations.length,
              signals: data.signals.length,
              alerts: data.alerts.length,
            },
            countryCode: 'CM',
            isDemo: true,
          },
        },
        { upsert: true },
      )
      .exec();

    return {
      rawRecords: data.rawRecords.length,
      observations: data.observations.length,
      signals: data.signals.length,
      alerts: data.alerts.length,
      sharingPolicies: data.sharingPolicies.length,
    };
  }

  private observationFilter(
    allowedCountryCodes: readonly string[] | null,
  ): Record<string, unknown> {
    return allowedCountryCodes
      ? { countryCode: { $in: allowedCountryCodes } }
      : {};
  }

  private async bulkInsertOnly<TModel, TSeed extends object>(
    model: Model<TModel>,
    records: readonly TSeed[],
    filterFor: (record: TSeed) => Record<string, unknown>,
  ): Promise<void> {
    if (!records.length) return;
    const operations = records.map((record) => ({
      updateOne: {
        filter: filterFor(record),
        update: { $setOnInsert: record },
        upsert: true,
      },
    }));
    await model.bulkWrite(
      operations as Parameters<Model<TModel>['bulkWrite']>[0],
      { ordered: false },
    );
  }
}
