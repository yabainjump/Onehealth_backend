import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';
import { HubRepository } from '../repositories/hub.repository';
import type { HubObservationDocument } from '../schemas/hub-observation.schema';
import type { HubSignalDocument } from '../schemas/hub-signal.schema';
import { HubService } from './hub.service';

function user(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: '507f1f77bcf86cd799439011',
    role: UserRole.USER,
    hubRoles: [HubRole.VIEWER],
    hubCountryCodes: ['CM'],
    ...overrides,
  } as PublicUser;
}

describe('HubService', () => {
  const summaryMock = jest.fn();
  const assignSignalMock = jest.fn();
  const decideSignalMock = jest.fn();
  const updateObservationStageMock = jest.fn();
  const upsertVerifiedAlertMock = jest.fn();
  const createAuditMock = jest.fn();
  const repository = {
    summary: summaryMock,
    listObservations: jest.fn(),
    findObservation: jest.fn(),
    relatedObservations: jest.fn(),
    findSignalByObservation: jest.fn(),
    findAlertByObservation: jest.fn(),
    listAudit: jest.fn(),
    assignSignal: assignSignalMock,
    decideSignal: decideSignalMock,
    updateObservationStage: updateObservationStageMock,
    upsertVerifiedAlert: upsertVerifiedAlertMock,
    createAudit: createAuditMock,
  } as unknown as jest.Mocked<HubRepository>;
  let service: HubService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HubService(repository);
  });

  it('limits a Hub user to configured countries', async () => {
    repository.summary.mockResolvedValue({
      total: 15,
      countries: 1,
      bySector: { human: 5, animal: 5, environment: 5 },
      byStage: { observation: 12, signal: 2, 'verified-alert': 1 },
    });

    await service.summary(user());

    expect(summaryMock).toHaveBeenCalledWith(['CM']);
  });

  it('grants an application administrator an unrestricted scope', async () => {
    repository.summary.mockResolvedValue({
      total: 0,
      countries: 0,
      bySector: { human: 0, animal: 0, environment: 0 },
      byStage: { observation: 0, signal: 0, 'verified-alert': 0 },
    });

    await service.summary(
      user({ role: UserRole.ADMIN, hubRoles: [], hubCountryCodes: [] }),
    );

    expect(summaryMock).toHaveBeenCalledWith(null);
  });

  it('rejects scoped access without an authorized country', async () => {
    await expect(
      service.summary(user({ hubCountryCodes: [] })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(summaryMock).not.toHaveBeenCalled();
  });

  it('audits signal assignment', async () => {
    const signal = {
      signalCode: 'SIG-ARIS-CM-01',
      observationId: 'OBS-ARIS-CM-01',
      status: 'UNDER_VERIFICATION',
      assignedTo: { toString: () => '507f1f77bcf86cd799439011' },
      countryCode: 'CM',
      isDemo: true,
    } as unknown as HubSignalDocument;
    repository.assignSignal.mockResolvedValue(signal);
    repository.createAudit.mockResolvedValue({} as never);

    await service.assignSignal(
      'SIG-ARIS-CM-01',
      user({ hubRoles: [HubRole.VERIFIER] }),
    );

    expect(createAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'SIG-ARIS-CM-01',
        action: 'SIGNAL_ASSIGNED',
        actorType: 'USER',
      }),
    );
  });

  it('refuses an invalid or concurrent workflow transition', async () => {
    repository.decideSignal.mockResolvedValue(null);

    await expect(
      service.decideSignal(
        'SIG-ARIS-CM-01',
        'VERIFIED',
        'Justification humaine suffisante.',
        user({ hubRoles: [HubRole.VERIFIER] }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates an alert only after a verified human decision', async () => {
    const signal = {
      signalCode: 'SIG-ARIS-CM-01',
      observationId: 'OBS-ARIS-CM-01',
      countryCode: 'CM',
      isDemo: true,
    } as HubSignalDocument;
    const observation = {
      canonicalId: 'OBS-ARIS-CM-01',
      sourceSystem: 'ARIS 3',
      sourceRecordId: 'ARIS-CM-01',
      sourceInstance: 'demo-ceeac-2026',
      sector: 'animal',
      countryCode: 'CM',
      countryName: 'Cameroun',
      adminArea: 'Centre',
      location: { type: 'Point', coordinates: [12.7, 5.7] },
      observedAt: new Date('2026-08-01T12:00:00.000Z'),
      receivedAt: new Date('2026-08-01T20:00:00.000Z'),
      category: 'Surveillance animale',
      title: 'Mortalité animale inhabituelle',
      summary: 'Résumé de démonstration',
      stage: 'signal',
      severity: 'high',
      metrics: [],
      sharingPolicyId: 'POLICY-DEMO-CM',
      scenarioId: 'CEEAC-DEMO-CM-01',
      isDemo: true,
    } as HubObservationDocument;
    repository.decideSignal.mockResolvedValue(signal);
    repository.findObservation.mockResolvedValue(observation);
    repository.updateObservationStage.mockResolvedValue(observation);
    repository.upsertVerifiedAlert.mockResolvedValue({} as never);
    repository.createAudit.mockResolvedValue({} as never);
    repository.relatedObservations.mockResolvedValue([]);
    repository.findSignalByObservation.mockResolvedValue(signal);
    repository.findAlertByObservation.mockResolvedValue(null);
    repository.listAudit.mockResolvedValue([]);

    await service.decideSignal(
      'SIG-ARIS-CM-01',
      'VERIFIED',
      'Validation humaine documentée.',
      user({ hubRoles: [HubRole.VERIFIER] }),
    );

    expect(updateObservationStageMock).toHaveBeenCalledWith(
      'OBS-ARIS-CM-01',
      'verified-alert',
      'critical',
    );
    expect(upsertVerifiedAlertMock).toHaveBeenCalled();
  });
});
