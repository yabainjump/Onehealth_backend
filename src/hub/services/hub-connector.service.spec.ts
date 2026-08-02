import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';
import { HubConnectorRepository } from '../repositories/hub-connector.repository';
import { HubRepository } from '../repositories/hub.repository';
import type { HubConnectorDocument } from '../schemas/hub-connector.schema';
import { HubConnectorService } from './hub-connector.service';

function user(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: '507f1f77bcf86cd799439011',
    role: UserRole.USER,
    hubRoles: [HubRole.VIEWER],
    hubCountryCodes: ['CM'],
    ...overrides,
  } as PublicUser;
}

function connector(): HubConnectorDocument {
  return {
    connectorId: 'CON-DHIS2-CM',
    countryCode: 'CM',
    countryName: 'Cameroun',
    institution: 'MINSANTÉ',
    sector: 'human',
    sourceSystem: 'DHIS2',
    protocol: 'API_REST',
    endpointAlias: 'dhis2://cm/demo',
    status: 'operational',
    availabilityPercent: 99,
    lastSyncAt: new Date('2026-08-02T11:50:00.000Z'),
    lastSuccessAt: new Date('2026-08-02T11:50:00.000Z'),
    nextSyncAt: new Date('2026-08-02T12:50:00.000Z'),
    recordsReceived: 5,
    recordsAccepted: 5,
    recordsRejected: 0,
    duplicateRecords: 0,
    lastDurationMs: 700,
    lastErrorCode: '',
    lastErrorMessage: '',
    enabled: true,
    isDemo: true,
  } as HubConnectorDocument;
}

describe('HubConnectorService', () => {
  const listMock = jest.fn();
  const summaryMock = jest.fn();
  const synchronizeDemoMock = jest.fn();
  const createAuditMock = jest.fn();
  const connectorRepository = {
    list: listMock,
    summary: summaryMock,
    synchronizeDemo: synchronizeDemoMock,
  } as unknown as jest.Mocked<HubConnectorRepository>;
  const hubRepository = {
    createAudit: createAuditMock,
  } as unknown as jest.Mocked<HubRepository>;
  let service: HubConnectorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HubConnectorService(connectorRepository, hubRepository);
  });

  it('limits the list to the countries assigned to the Hub user', async () => {
    listMock.mockResolvedValue({ items: [], total: 0 });

    await service.list({ page: 1, limit: 20 }, user());

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCountryCodes: ['CM'] }),
    );
  });

  it('uses an unrestricted scope for a Hub administrator', async () => {
    summaryMock.mockResolvedValue({
      total: 0,
      countries: 0,
      sectors: [],
      statuses: { operational: 0, degraded: 0, error: 0, suspended: 0 },
    });

    await service.summary(
      user({ hubRoles: [HubRole.ADMIN], hubCountryCodes: [] }),
    );

    expect(summaryMock).toHaveBeenCalledWith(null);
  });

  it('audits a demo synchronization and reports ignored duplicates', async () => {
    const item = connector();
    synchronizeDemoMock.mockResolvedValue([item]);
    createAuditMock.mockResolvedValue({});

    const result = await service.synchronize(
      user({ hubRoles: [HubRole.ADMIN], hubCountryCodes: [] }),
    );

    expect(result.observationsCreated).toBe(0);
    expect(result.duplicatesIgnored).toBe(5);
    expect(createAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'connector',
        entityId: 'CON-DHIS2-CM',
        action: 'DEMO_CONNECTOR_SYNCHRONIZED',
      }),
    );
  });
});
