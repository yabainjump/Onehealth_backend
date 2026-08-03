import { BadRequestException } from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';
import type { HubRepository } from '../repositories/hub.repository';
import type { HubEventDocument } from '../schemas/hub-event.schema';
import type { HubObservationDocument } from '../schemas/hub-observation.schema';
import { HubEventService } from './hub-event.service';

const admin = {
  id: '507f1f77bcf86cd799439011',
  role: UserRole.ADMIN,
  hubRoles: [HubRole.ADMIN],
  hubCountryCodes: [],
} as PublicUser;

function observation(
  id: string,
  sector: 'human' | 'animal' | 'environment',
  countryCode: string,
  coordinates: [number, number],
  minutes: number,
) {
  return {
    canonicalId: id,
    title: `${sector} observation`,
    category: 'Surveillance intégrée',
    sector,
    sourceSystem:
      sector === 'human' ? 'DHIS2' : sector === 'animal' ? 'ARIS 3' : 'CAPC-AC',
    countryCode,
    countryName: countryCode,
    adminArea: 'Zone test',
    observedAt: new Date(Date.UTC(2026, 7, 3, 10, minutes)),
    location: { type: 'Point', coordinates },
    severity: 'high',
    isDemo: true,
  } as HubObservationDocument;
}

describe('HubEventService', () => {
  const repository = {
    findObservationsByIds: jest.fn(),
    upsertEvent: jest.fn(),
    assignEventToObservations: jest.fn(),
    createAudit: jest.fn(),
  } as unknown as jest.Mocked<HubRepository>;
  let service: HubEventService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HubEventService(repository);
    repository.assignEventToObservations.mockResolvedValue();
    repository.createAudit.mockResolvedValue({} as never);
    repository.upsertEvent.mockImplementation(
      async (input) => input as HubEventDocument,
    );
  });

  it('consolidates close multisector and cross-border observations with an explainable score', async () => {
    repository.findObservationsByIds.mockResolvedValue([
      observation('OBS-CAPC-CM-91', 'environment', 'CM', [14.32, 10.59], 0),
      observation('OBS-ARIS-CM-91', 'animal', 'CM', [14.45, 10.72], 8),
      observation('OBS-DHIS2-CM-91', 'human', 'CM', [14.28, 10.63], 15),
      observation('OBS-DHIS2-TD-91', 'human', 'TD', [15.03, 10.18], 22),
    ]);

    const event = await service.consolidate(
      [
        'OBS-CAPC-CM-91',
        'OBS-ARIS-CM-91',
        'OBS-DHIS2-CM-91',
        'OBS-DHIS2-TD-91',
      ],
      admin,
      'SCN-CM-TD-CONVERGENCE-01',
    );

    expect(event.correlationScore).toBeGreaterThanOrEqual(0.9);
    expect(event.sectors).toEqual(['animal', 'environment', 'human']);
    expect(event.countryCodes).toEqual(['CM', 'TD']);
    expect(event.correlationReasons).toHaveLength(5);
    expect(repository.assignEventToObservations).toHaveBeenCalledWith(
      expect.arrayContaining(['OBS-DHIS2-CM-91', 'OBS-DHIS2-TD-91']),
      event.eventCode,
    );
  });

  it('refuses to present a single-sector cluster as One Health consolidation', async () => {
    repository.findObservationsByIds.mockResolvedValue([
      observation('OBS-DHIS2-CM-91', 'human', 'CM', [14.28, 10.63], 0),
      observation('OBS-DHIS2-TD-91', 'human', 'TD', [15.03, 10.18], 10),
    ]);

    await expect(
      service.consolidate(['OBS-DHIS2-CM-91', 'OBS-DHIS2-TD-91'], admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
