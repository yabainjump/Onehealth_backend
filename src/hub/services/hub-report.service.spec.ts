import { ConflictException } from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';
import type { HubRepository } from '../repositories/hub.repository';
import type { HubAlertDocument } from '../schemas/hub-alert.schema';
import type { HubAlertReportDocument } from '../schemas/hub-alert-report.schema';
import type { HubObservationDocument } from '../schemas/hub-observation.schema';
import { HubReportService } from './hub-report.service';

const user = {
  id: '507f1f77bcf86cd799439011',
  role: UserRole.USER,
  hubRoles: [HubRole.ANALYST],
  hubCountryCodes: ['CM'],
} as PublicUser;

const observation = {
  canonicalId: 'OBS-DHIS2-CM-01',
  sourceSystem: 'DHIS2',
  title: 'Cas fébriles inhabituels',
  summary: 'Une hausse inhabituelle a été confirmée.',
  countryCode: 'CM',
  countryName: 'Cameroun',
  adminArea: 'Centre',
  sector: 'human',
  severity: 'critical',
  isDemo: true,
} as HubObservationDocument;

const alert = {
  alertCode: 'ALT-DHIS2-CM-01',
  observationId: observation.canonicalId,
  status: 'VERIFIED',
  summary: observation.summary,
} as HubAlertDocument;

describe('HubReportService', () => {
  const repository = {
    findObservation: jest.fn(),
    findAlertByObservation: jest.fn(),
    relatedObservations: jest.fn(),
    latestReport: jest.fn(),
    createReport: jest.fn(),
    createAudit: jest.fn(),
    listReports: jest.fn(),
    findReport: jest.fn(),
    updateReportStatus: jest.fn(),
  } as unknown as jest.Mocked<HubRepository>;
  let service: HubReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HubReportService(repository);
    repository.findObservation.mockResolvedValue(observation);
    repository.findAlertByObservation.mockResolvedValue(alert);
    repository.relatedObservations.mockResolvedValue([]);
    repository.latestReport.mockResolvedValue(null);
    repository.createAudit.mockResolvedValue({} as never);
  });

  it('creates a new persistent draft version for a verified alert', async () => {
    repository.createReport.mockImplementation(
      async (input) =>
        ({
          ...input,
          validatedBy: '',
          validatedAt: null,
          publishedBy: '',
          publishedAt: null,
        }) as HubAlertReportDocument,
    );

    const report = await service.generate(observation.canonicalId, user);

    expect(report.reportId).toBe('RPT-ALT-DHIS2-CM-01-V1');
    expect(report.status).toBe('DRAFT');
    expect(repository.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REPORT_VERSION_GENERATED' }),
    );
  });

  it('refuses report generation before human alert verification', async () => {
    repository.findAlertByObservation.mockResolvedValue(null);

    await expect(
      service.generate(observation.canonicalId, user),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
