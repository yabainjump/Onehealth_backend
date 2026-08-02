import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HubConnectorStatus,
  HubSector,
  HubSourceSystem,
  HUB_CONNECTION,
} from '../hub.constants';
import { buildHubCountryFilter } from '../hub-access-scope';
import {
  HubDemoConnectorSeed,
  HubDemoIngestionRunSeed,
} from '../seeds/hub-demo-connectors.factory';
import {
  HubConnector,
  HubConnectorDocument,
} from '../schemas/hub-connector.schema';
import { HubIngestionRun } from '../schemas/hub-ingestion-run.schema';

export interface HubConnectorListFilter {
  readonly search?: string;
  readonly countryCode?: string;
  readonly sector?: HubSector;
  readonly status?: HubConnectorStatus;
  readonly sourceSystem?: HubSourceSystem;
  readonly allowedCountryCodes: readonly string[] | null;
  readonly page: number;
  readonly limit: number;
}

@Injectable()
export class HubConnectorRepository {
  constructor(
    @InjectModel(HubConnector.name, HUB_CONNECTION)
    private readonly connectorModel: Model<HubConnector>,
    @InjectModel(HubIngestionRun.name, HUB_CONNECTION)
    private readonly ingestionRunModel: Model<HubIngestionRun>,
  ) {}

  async list(filter: HubConnectorListFilter): Promise<{
    items: HubConnectorDocument[];
    total: number;
  }> {
    const mongoFilter = buildHubCountryFilter(
      filter.allowedCountryCodes,
      filter.countryCode,
    );
    if (filter.sector) mongoFilter.sector = filter.sector;
    if (filter.status) mongoFilter.status = filter.status;
    if (filter.sourceSystem) mongoFilter.sourceSystem = filter.sourceSystem;

    const search = filter.search?.trim();
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safeSearch, 'i');
      mongoFilter.$or = [
        { connectorId: regex },
        { countryName: regex },
        { institution: regex },
        { sourceSystem: regex },
      ];
    }

    const [items, total] = await Promise.all([
      this.connectorModel
        .find(mongoFilter)
        .sort({ countryName: 1, sector: 1 })
        .skip((filter.page - 1) * filter.limit)
        .limit(filter.limit)
        .exec(),
      this.connectorModel.countDocuments(mongoFilter).exec(),
    ]);
    return { items, total };
  }

  async summary(allowedCountryCodes: readonly string[] | null) {
    const connectors = await this.connectorModel
      .find(this.countryFilter(allowedCountryCodes))
      .select('sector status availabilityPercent countryCode')
      .lean()
      .exec();

    const sectors = (['human', 'animal', 'environment'] as const).map(
      (sector) => {
        const items = connectors.filter((item) => item.sector === sector);
        const availability = items.length
          ? Math.round(
              items.reduce(
                (total, item) => total + item.availabilityPercent,
                0,
              ) / items.length,
            )
          : 0;
        return {
          sector,
          total: items.length,
          availabilityPercent: availability,
          operational: items.filter((item) => item.status === 'operational')
            .length,
          degraded: items.filter((item) => item.status === 'degraded').length,
          error: items.filter((item) => item.status === 'error').length,
          suspended: items.filter((item) => item.status === 'suspended').length,
        };
      },
    );

    return {
      total: connectors.length,
      countries: new Set(connectors.map((item) => item.countryCode)).size,
      sectors,
      statuses: {
        operational: connectors.filter((item) => item.status === 'operational')
          .length,
        degraded: connectors.filter((item) => item.status === 'degraded')
          .length,
        error: connectors.filter((item) => item.status === 'error').length,
        suspended: connectors.filter((item) => item.status === 'suspended')
          .length,
      },
    };
  }

  async synchronizeDemo(
    actorId: string,
    allowedCountryCodes: readonly string[] | null,
  ): Promise<HubConnectorDocument[]> {
    const connectors = await this.connectorModel
      .find({
        ...this.countryFilter(allowedCountryCodes),
        enabled: true,
      })
      .exec();

    const now = new Date();
    const nextSyncAt = new Date(now.getTime() + 60 * 60_000);
    const updated: HubConnectorDocument[] = [];

    for (const connector of connectors) {
      const durationMs = 420 + (connector.connectorId.length % 11) * 37;
      const result = await this.connectorModel
        .findOneAndUpdate(
          { connectorId: connector.connectorId, enabled: true },
          {
            $set: {
              status: 'operational',
              availabilityPercent: 100,
              lastSyncAt: now,
              lastSuccessAt: now,
              nextSyncAt,
              lastDurationMs: durationMs,
              lastErrorCode: '',
              lastErrorMessage: '',
            },
          },
          { new: true, runValidators: true },
        )
        .exec();
      if (!result) continue;

      await this.ingestionRunModel.create({
        runId: `RUN-MANUAL-${randomUUID()}`,
        connectorId: result.connectorId,
        countryCode: result.countryCode,
        status: 'SUCCESS',
        startedAt: new Date(now.getTime() - durationMs),
        completedAt: now,
        // La relance de démonstration relit le même lot sans créer
        // d'observations supplémentaires : les lignes sont des doublons.
        recordsReceived: result.recordsReceived,
        recordsAccepted: 0,
        recordsRejected: 0,
        duplicateRecords: result.recordsReceived,
        durationMs,
        triggeredBy: 'USER',
        actorId,
        errorCode: '',
        isDemo: true,
      });
      updated.push(result);
    }

    return updated;
  }

  async seedDemo(data: {
    connectors: readonly HubDemoConnectorSeed[];
    ingestionRuns: readonly HubDemoIngestionRunSeed[];
  }) {
    if (data.connectors.length) {
      await this.connectorModel.bulkWrite(
        data.connectors.map((connector) => ({
          updateOne: {
            filter: { connectorId: connector.connectorId },
            update: { $setOnInsert: connector },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }
    if (data.ingestionRuns.length) {
      await this.ingestionRunModel.bulkWrite(
        data.ingestionRuns.map((run) => ({
          updateOne: {
            filter: { runId: run.runId },
            update: { $setOnInsert: run },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }
    return {
      connectors: data.connectors.length,
      ingestionRuns: data.ingestionRuns.length,
    };
  }

  private countryFilter(
    allowedCountryCodes: readonly string[] | null,
  ): Record<string, unknown> {
    return allowedCountryCodes
      ? { countryCode: { $in: allowedCountryCodes } }
      : {};
  }
}
