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
  const findObservation = jest.fn<HubRepository['findObservation']>();
  const findAlertByObservation =
    jest.fn<HubRepository['findAlertByObservation']>();
  const relatedObservations = jest.fn<HubRepository['relatedObservations']>();
  const latestReport = jest.fn<HubRepository['latestReport']>();
  const createReport = jest.fn<HubRepository['createReport']>();
  const createAudit = jest.fn<HubRepository['createAudit']>();
  const repository = {
    findObservation,
    findAlertByObservation,
    relatedObservations,
    latestReport,
    createReport,
    createAudit,
    listReports: jest.fn(),
    findReport: jest.fn(),
    updateReportStatus: jest.fn(),
  } as unknown as HubRepository;
  let service: HubReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HubReportService(repository);
    findObservation.mockResolvedValue(observation);
    findAlertByObservation.mockResolvedValue(alert);
    relatedObservations.mockResolvedValue([]);
    latestReport.mockResolvedValue(null);
    createAudit.mockResolvedValue({});
  });

  it('creates a new persistent draft version for a verified alert', async () => {
    createReport.mockImplementation((input) =>
      Promise.resolve({
        ...input,
        validatedBy: '',
        validatedAt: null,
        publishedBy: '',
        publishedAt: null,
      } as HubAlertReportDocument),
    );

    const report = await service.generate(observation.canonicalId, user);

    expect(report.reportId).toBe('RPT-ALT-DHIS2-CM-01-V1');
    expect(report.status).toBe('DRAFT');
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REPORT_VERSION_GENERATED' }),
    );
  });

  it('refuses report generation before human alert verification', async () => {
    findAlertByObservation.mockResolvedValue(null);

    await expect(
      service.generate(observation.canonicalId, user),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
