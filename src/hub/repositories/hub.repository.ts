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
import {
  HubSharingPolicy,
  HubSharingPolicyDocument,
} from '../schemas/hub-sharing-policy.schema';
import { HubSignal, HubSignalDocument } from '../schemas/hub-signal.schema';
import {
  HubScenarioRun,
  HubScenarioRunDocument,
} from '../schemas/hub-scenario-run.schema';
import {
  HubAlertReport,
  HubAlertReportDocument,
} from '../schemas/hub-alert-report.schema';
import type { HubReportStatus } from '../hub.constants';
import { HubEvent, HubEventDocument } from '../schemas/hub-event.schema';

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
    | 'sharing-policy'
    | 'seed'
    | 'scenario'
    | 'report'
    | 'event';
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
    @InjectModel(HubScenarioRun.name, HUB_CONNECTION)
    private readonly scenarioRunModel: Model<HubScenarioRun>,
    @InjectModel(HubAlertReport.name, HUB_CONNECTION)
    private readonly alertReportModel: Model<HubAlertReport>,
    @InjectModel(HubEvent.name, HUB_CONNECTION)
    private readonly eventModel: Model<HubEvent>,
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

  findObservationsByIds(
    canonicalIds: readonly string[],
    allowedCountryCodes: readonly string[] | null,
  ): Promise<HubObservationDocument[]> {
    return this.observationModel
      .find({
        ...this.observationFilter(allowedCountryCodes),
        canonicalId: { $in: canonicalIds },
      })
      .sort({ observedAt: 1, canonicalId: 1 })
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

  async listDossierAudit(entityIds: readonly string[], countryCode: string) {
    return this.auditLogModel
      .find({ entityId: { $in: entityIds }, countryCode })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();
  }

  async listDecisionSignals(allowedCountryCodes: readonly string[] | null) {
    const filter: Record<string, unknown> = {
      status: { $in: ['SIGNAL_DETECTED', 'UNDER_VERIFICATION'] },
    };
    if (allowedCountryCodes) filter.countryCode = { $in: allowedCountryCodes };
    const signals = await this.signalModel
      .find(filter)
      .sort({ riskLevel: -1, detectedAt: -1 })
      .limit(100)
      .exec();
    const observations = await this.observationModel
      .find({
        canonicalId: { $in: signals.map((signal) => signal.observationId) },
      })
      .exec();
    const byId = new Map(observations.map((item) => [item.canonicalId, item]));
    return signals.map((signal) => ({
      signal,
      observation: byId.get(signal.observationId) ?? null,
    }));
  }

  findScenario(scenarioCode: string): Promise<HubScenarioRunDocument | null> {
    return this.scenarioRunModel.findOne({ scenarioCode }).exec();
  }

  async startScenario(input: {
    scenarioCode: string;
    title: string;
    description: string;
    steps: readonly { code: string; label: string }[];
    initiatedBy: string;
    startedAt: Date;
  }) {
    return this.scenarioRunModel
      .findOneAndUpdate(
        { scenarioCode: input.scenarioCode },
        {
          $set: {
            title: input.title,
            description: input.description,
            status: 'RUNNING',
            steps: input.steps.map((step) => ({
              ...step,
              status: 'PENDING',
              completedAt: null,
            })),
            observationIds: [],
            signalCode: '',
            eventCode: '',
            initiatedBy: input.initiatedBy,
            startedAt: input.startedAt,
            completedAt: null,
            isDemo: true,
          },
        },
        { upsert: true, new: true, runValidators: true },
      )
      .exec();
  }

  async completeScenario(input: {
    scenarioCode: string;
    observationIds: readonly string[];
    signalCode: string;
    eventCode: string;
    completedAt: Date;
  }) {
    return this.scenarioRunModel
      .findOneAndUpdate(
        { scenarioCode: input.scenarioCode },
        {
          $set: {
            status: 'COMPLETED',
            observationIds: input.observationIds,
            signalCode: input.signalCode,
            eventCode: input.eventCode,
            completedAt: input.completedAt,
            'steps.$[].status': 'COMPLETED',
            'steps.$[].completedAt': input.completedAt,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
  }

  failScenario(scenarioCode: string) {
    return this.scenarioRunModel
      .findOneAndUpdate(
        { scenarioCode },
        { $set: { status: 'FAILED', completedAt: new Date() } },
        { new: true },
      )
      .exec();
  }

  async upsertScenarioData(data: {
    rawRecords: readonly HubDemoRawSeed[];
    observations: readonly HubDemoObservationSeed[];
    signal: HubDemoSignalSeed;
  }) {
    // Une relance rejoue le workflow de démonstration depuis le signal. Les
    // rapports restent historisés, mais une ancienne alerte vérifiée ne doit
    // pas rendre le nouveau signal artificiellement validé.
    await this.alertModel
      .deleteOne({
        signalCode: data.signal.signalCode,
        observationId: data.signal.observationId,
        isDemo: true,
      })
      .exec();
    await Promise.all([
      this.bulkUpsert(this.rawRecordModel, data.rawRecords, (record) => ({
        sourceSystem: record.sourceSystem,
        sourceInstance: record.sourceInstance,
        countryCode: record.countryCode,
        sourceRecordId: record.sourceRecordId,
      })),
      this.bulkUpsert(this.observationModel, data.observations, (record) => ({
        canonicalId: record.canonicalId,
      })),
      this.bulkUpsert(this.signalModel, [data.signal], (record) => ({
        signalCode: record.signalCode,
      })),
    ]);
  }

  listReports(
    alertCode: string,
    countryCode: string,
  ): Promise<HubAlertReportDocument[]> {
    return this.alertReportModel
      .find({ alertCode, countryCode })
      .sort({ version: -1 })
      .exec();
  }

  latestReport(alertCode: string): Promise<HubAlertReportDocument | null> {
    return this.alertReportModel
      .findOne({ alertCode })
      .sort({ version: -1 })
      .exec();
  }

  createReport(
    input: Omit<
      HubAlertReport,
      'validatedBy' | 'validatedAt' | 'publishedBy' | 'publishedAt'
    >,
  ) {
    return this.alertReportModel.create({
      ...input,
      validatedBy: '',
      validatedAt: null,
      publishedBy: '',
      publishedAt: null,
    });
  }

  updateReportStatus(
    reportId: string,
    from: HubReportStatus,
    to: HubReportStatus,
    actorId: string,
    countryCodes: readonly string[] | null,
  ) {
    const filter: Record<string, unknown> = { reportId, status: from };
    if (countryCodes) filter.countryCode = { $in: countryCodes };
    const set: Record<string, unknown> = { status: to };
    const now = new Date();
    if (to === 'VALIDATED') {
      set.validatedBy = actorId;
      set.validatedAt = now;
    }
    if (to === 'PUBLISHED') {
      set.publishedBy = actorId;
      set.publishedAt = now;
    }
    return this.alertReportModel
      .findOneAndUpdate(
        filter,
        { $set: set },
        { new: true, runValidators: true },
      )
      .exec();
  }

  findReport(reportId: string, countryCodes: readonly string[] | null) {
    const filter: Record<string, unknown> = { reportId };
    if (countryCodes) filter.countryCode = { $in: countryCodes };
    return this.alertReportModel.findOne(filter).exec();
  }

  listEvents(
    allowedCountryCodes: readonly string[] | null,
    limit = 100,
  ): Promise<HubEventDocument[]> {
    const filter = allowedCountryCodes
      ? { countryCodes: { $in: allowedCountryCodes } }
      : {};
    return this.eventModel
      .find(filter)
      .sort({ correlationScore: -1, lastObservedAt: -1 })
      .limit(limit)
      .exec();
  }

  findEvent(
    eventCode: string,
    allowedCountryCodes: readonly string[] | null,
  ): Promise<HubEventDocument | null> {
    const filter: Record<string, unknown> = { eventCode };
    if (allowedCountryCodes) filter.countryCodes = { $in: allowedCountryCodes };
    return this.eventModel.findOne(filter).exec();
  }

  upsertEvent(input: HubEvent): Promise<HubEventDocument | null> {
    return this.eventModel
      .findOneAndUpdate(
        { eventCode: input.eventCode },
        { $set: input },
        { upsert: true, returnDocument: 'after', runValidators: true },
      )
      .exec();
  }

  async assignEventToObservations(
    observationIds: readonly string[],
    eventCode: string,
  ): Promise<void> {
    await this.observationModel
      .updateMany(
        { canonicalId: { $in: observationIds } },
        { $set: { eventCode } },
      )
      .exec();
  }

  listSharingPolicies(
    allowedCountryCodes: readonly string[] | null,
  ): Promise<HubSharingPolicyDocument[]> {
    const filter = allowedCountryCodes
      ? { countryOwner: { $in: allowedCountryCodes } }
      : {};
    return this.sharingPolicyModel
      .find(filter)
      .sort({ countryOwner: 1, policyId: 1 })
      .exec();
  }

  updateSharingPolicy(
    policyId: string,
    allowedCountryCodes: readonly string[] | null,
    updates: Pick<
      HubSharingPolicy,
      | 'sharingLevel'
      | 'allowedRoles'
      | 'allowedCountries'
      | 'aggregationLevel'
      | 'retentionPeriodDays'
      | 'containsPersonalData'
    >,
  ): Promise<HubSharingPolicyDocument | null> {
    const filter: Record<string, unknown> = { policyId };
    if (allowedCountryCodes) {
      filter.countryOwner = { $in: allowedCountryCodes };
    }
    return this.sharingPolicyModel
      .findOneAndUpdate(
        filter,
        { $set: updates },
        { returnDocument: 'after', runValidators: true },
      )
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
    const document = {
      ...(input.auditKey ? { auditKey: input.auditKey } : {}),
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      actorType: input.actorType,
      metadata: input.metadata ?? {},
      countryCode: input.countryCode,
      isDemo: input.isDemo,
    };
    if (input.auditKey) {
      return this.auditLogModel
        .findOneAndUpdate(
          { auditKey: input.auditKey },
          { $setOnInsert: document },
          { upsert: true, new: true },
        )
        .exec();
    }
    return this.auditLogModel.create(document);
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

  private async bulkUpsert<TModel, TSeed extends object>(
    model: Model<TModel>,
    records: readonly TSeed[],
    filterFor: (record: TSeed) => Record<string, unknown>,
  ): Promise<void> {
    if (!records.length) return;
    await model.bulkWrite(
      records.map((record) => ({
        updateOne: {
          filter: filterFor(record),
          update: { $set: record },
          upsert: true,
        },
      })) as Parameters<Model<TModel>['bulkWrite']>[0],
      { ordered: false },
    );
  }
}
