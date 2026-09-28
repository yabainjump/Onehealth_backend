import { Injectable, NotFoundException } from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { ListHubConnectorsDto } from '../dto/list-hub-connectors.dto';
import { resolveHubCountryScope } from '../hub-access-scope';
import { HubConnectorRepository } from '../repositories/hub-connector.repository';
import { HubRepository } from '../repositories/hub.repository';
import { HubConnectorDocument } from '../schemas/hub-connector.schema';
import { SimulateHubConnectorDto } from '../dto/hub-import.dto';

@Injectable()
export class HubConnectorService {
  constructor(
    private readonly connectorRepository: HubConnectorRepository,
    private readonly hubRepository: HubRepository,
  ) {}

  async list(query: ListHubConnectorsDto, user: PublicUser) {
    const page = Math.max(query.page, 1);
    const limit = Math.min(Math.max(query.limit, 1), 100);
    const result = await this.connectorRepository.list({
      search: query.search,
      countryCode: query.countryCode,
      sector: query.sector,
      status: query.status,
      sourceSystem: query.sourceSystem,
      allowedCountryCodes: resolveHubCountryScope(user),
      page,
      limit,
    });
    return {
      items: result.items.map((connector) => this.present(connector)),
      total: result.total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(result.total / limit)),
      simulated: true,
    };
  }

  async summary(user: PublicUser) {
    const summary = await this.connectorRepository.summary(
      resolveHubCountryScope(user),
    );
    return { ...summary, simulated: true };
  }

  async synchronize(user: PublicUser) {
    const connectors = await this.connectorRepository.synchronizeDemo(
      user.id,
      resolveHubCountryScope(user),
    );

    await Promise.all(
      connectors.map((connector) =>
        this.hubRepository.createAudit({
          entityType: 'connector',
          entityId: connector.connectorId,
          action: 'DEMO_CONNECTOR_SYNCHRONIZED',
          actorId: user.id,
          actorType: 'USER',
          metadata: {
            recordsRead: connector.recordsReceived,
            recordsCreated: 0,
            duplicatesIgnored: connector.recordsReceived,
          },
          countryCode: connector.countryCode,
          isDemo: true,
        }),
      ),
    );

    return {
      synchronized: connectors.length,
      observationsCreated: 0,
      duplicatesIgnored: connectors.reduce(
        (total, connector) => total + connector.recordsReceived,
        0,
      ),
      completedAt: new Date(),
      simulated: true,
      message:
        'Synchronisation de démonstration terminée sans dupliquer les observations existantes.',
    };
  }

  async simulate(dto: SimulateHubConnectorDto, user: PublicUser) {
    const result = await this.connectorRepository.simulate({
      connectorId: dto.connectorId,
      scenario: dto.scenario,
      actorId: user.id,
      allowedCountryCodes: resolveHubCountryScope(user),
    });
    if (!result) {
      throw new NotFoundException(
        'Connecteur de démonstration introuvable dans le périmètre autorisé.',
      );
    }
    await this.hubRepository.createAudit({
      entityType: 'connector',
      entityId: result.connector.connectorId,
      action: 'DEMO_CONNECTOR_SCENARIO_EXECUTED',
      actorId: user.id,
      actorType: 'USER',
      countryCode: result.connector.countryCode,
      isDemo: true,
      metadata: {
        scenario: dto.scenario,
        runId: result.runId,
        status: result.runStatus,
        recordsReceived: result.recordsReceived,
        recordsAccepted: result.recordsAccepted,
        recordsRejected: result.recordsRejected,
        duplicateRecords: result.duplicateRecords,
        errorCode: result.errorCode,
      },
    });
    return {
      runId: result.runId,
      scenario: dto.scenario,
      status: result.runStatus,
      connector: this.present(result.connector),
      counts: {
        received: result.recordsReceived,
        accepted: result.recordsAccepted,
        rejected: result.recordsRejected,
        duplicates: result.duplicateRecords,
      },
      errorCode: result.errorCode || null,
      simulated: true,
      message:
        "Simulation terminée sans appel à une plateforme institutionnelle et sans créer d'alerte.",
    };
  }

  private present(connector: HubConnectorDocument) {
    return {
      id: connector.connectorId,
      countryCode: connector.countryCode,
      countryName: connector.countryName,
      institution: connector.institution,
      sector: connector.sector,
      sourceSystem: connector.sourceSystem,
      protocol: connector.protocol,
      endpointAlias: connector.endpointAlias,
      status: connector.status,
      availabilityPercent: connector.availabilityPercent,
      lastSyncAt: connector.lastSyncAt,
      lastSuccessAt: connector.lastSuccessAt,
      nextSyncAt: connector.nextSyncAt,
      volume: {
        received: connector.recordsReceived,
        accepted: connector.recordsAccepted,
        rejected: connector.recordsRejected,
        duplicates: connector.duplicateRecords,
      },
      lastDurationMs: connector.lastDurationMs,
      error:
        connector.lastErrorCode || connector.lastErrorMessage
          ? {
              code: connector.lastErrorCode,
              message: connector.lastErrorMessage,
            }
          : null,
      enabled: connector.enabled,
      simulated: connector.isDemo,
    };
  }
}
