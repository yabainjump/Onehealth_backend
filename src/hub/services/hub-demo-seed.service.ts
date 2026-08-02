import { Injectable } from '@nestjs/common';
import { HubConnectorRepository } from '../repositories/hub-connector.repository';
import { HubRepository } from '../repositories/hub.repository';
import { createHubDemoConnectors } from '../seeds/hub-demo-connectors.factory';
import { createHubDemoSeed } from '../seeds/hub-demo-data.factory';

@Injectable()
export class HubDemoSeedService {
  constructor(
    private readonly repository: HubRepository,
    private readonly connectorRepository: HubConnectorRepository,
  ) {}

  async seed() {
    const [result, connectorResult] = await Promise.all([
      this.repository.seedDemo(createHubDemoSeed()),
      this.connectorRepository.seedDemo(createHubDemoConnectors()),
    ]);
    return {
      ...result,
      ...connectorResult,
      idempotent: true,
      message:
        'Données simulées du Hub chargées. Une nouvelle exécution ne crée aucun doublon.',
    };
  }
}
