import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import {
  CEEAC_COUNTRY_CODES,
  HUB_SIGNAL_TRANSITION_ERROR,
} from '../hub.constants';
import { ListHubObservationsDto } from '../dto/list-hub-observations.dto';
import { UpdateHubSharingPolicyDto } from '../dto/update-hub-sharing-policy.dto';
import { resolveHubCountryScope } from '../hub-access-scope';
import { HubRepository } from '../repositories/hub.repository';
import { HubObservationDocument } from '../schemas/hub-observation.schema';
import { HubSharingPolicyDocument } from '../schemas/hub-sharing-policy.schema';
import { HubSignalDocument } from '../schemas/hub-signal.schema';
import { HubEventService } from './hub-event.service';

@Injectable()
export class HubService {
  constructor(
    private readonly repository: HubRepository,
    private readonly eventService: HubEventService,
  ) {}

  async summary(user: PublicUser) {
    const result = await this.repository.summary(resolveHubCountryScope(user));
    return {
      ...result,
      completeness: result.total > 0 ? 100 : 0,
      simulated: true,
    };
  }

  async listObservations(query: ListHubObservationsDto, user: PublicUser) {
    const page = Math.max(query.page, 1);
    const limit = Math.min(Math.max(query.limit, 1), 100);
    const result = await this.repository.listObservations({
      search: query.search,
      countryCode: query.countryCode,
      sector: query.sector,
      stage: query.stage,
      allowedCountryCodes: resolveHubCountryScope(user),
      page,
      limit,
    });

    return {
      items: result.items.map((item) => this.presentObservation(item)),
      total: result.total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(result.total / limit)),
      simulated: true,
    };
  }

  async observationDetail(canonicalId: string, user: PublicUser) {
    const safeId = this.canonicalId(canonicalId);
    const countries = resolveHubCountryScope(user);
    const observation = await this.repository.findObservation(
      safeId,
      countries,
    );
    if (!observation) throw new NotFoundException('Hub observation not found');

    const [related, signal, alert] = await Promise.all([
      this.repository.relatedObservations(observation, countries),
      this.repository.findSignalByObservation(observation.canonicalId),
      this.repository.findAlertByObservation(observation.canonicalId),
    ]);
    const reports = alert
      ? await this.repository.listReports(
          alert.alertCode,
          observation.countryCode,
        )
      : [];
    const event = observation.eventCode
      ? await this.eventService.detail(observation.eventCode, user)
      : null;
    const audit = await this.repository.listDossierAudit(
      [
        observation.canonicalId,
        observation.scenarioId,
        ...(observation.eventCode ? [observation.eventCode] : []),
        ...(signal ? [signal.signalCode] : []),
        ...(alert ? [alert.alertCode] : []),
        ...reports.map((report) => report.reportId),
      ],
      observation.countryCode,
    );

    return {
      observation: this.presentObservation(observation),
      related: related.map((item) => this.presentObservation(item)),
      signal: signal ? this.presentSignal(signal) : null,
      alert: alert
        ? {
            alertCode: alert.alertCode,
            status: alert.status,
            verifiedBy: alert.verifiedBy,
            verifiedAt: alert.verifiedAt,
            verificationNote: alert.verificationNote,
          }
        : null,
      audit,
      event,
      simulated: true,
    };
  }

  async decisions(user: PublicUser) {
    const rows = await this.repository.listDecisionSignals(
      resolveHubCountryScope(user),
    );
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const items = rows
      .filter((row) => row.observation)
      .map(({ signal, observation }) => ({
        signalCode: signal.signalCode,
        observationId: signal.observationId,
        title: observation!.title,
        countryCode: observation!.countryCode,
        countryName: observation!.countryName,
        adminArea: observation!.adminArea,
        sector: observation!.sector,
        priority: signal.riskLevel,
        confidenceScore: signal.confidenceScore,
        status: signal.status,
        assignedTo: signal.assignedTo?.toString() ?? null,
        detectedAt: signal.detectedAt,
        dueAt: new Date(signal.detectedAt.getTime() + 24 * 60 * 60 * 1000),
        simulated: signal.isDemo,
      }))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return {
      items,
      total: items.length,
      simulated: items.every((item) => item.simulated),
    };
  }

  async listSharingPolicies(user: PublicUser) {
    const policies = await this.repository.listSharingPolicies(
      resolveHubCountryScope(user),
    );
    return {
      items: policies.map((policy) => this.presentSharingPolicy(policy)),
      total: policies.length,
      simulated: policies.every((policy) => policy.isDemo),
    };
  }

  async updateSharingPolicy(
    policyId: string,
    dto: UpdateHubSharingPolicyDto,
    user: PublicUser,
  ) {
    const safePolicyId = this.policyId(policyId);
    const updates = this.normalizeSharingPolicy(dto);
    const policy = await this.repository.updateSharingPolicy(
      safePolicyId,
      resolveHubCountryScope(user),
      updates,
    );
    if (!policy) throw new NotFoundException('Hub sharing policy not found');

    await this.repository.createAudit({
      entityType: 'sharing-policy',
      entityId: policy.policyId,
      action: 'SHARING_POLICY_UPDATED',
      actorId: user.id,
      actorType: 'USER',
      metadata: {
        sharingLevel: policy.sharingLevel,
        aggregationLevel: policy.aggregationLevel,
        retentionPeriodDays: policy.retentionPeriodDays,
        containsPersonalData: policy.containsPersonalData,
        allowedRoles: policy.allowedRoles,
        allowedCountries: policy.allowedCountries,
      },
      countryCode: policy.countryOwner,
      isDemo: policy.isDemo,
    });
    return this.presentSharingPolicy(policy);
  }

  async assignSignal(signalCode: string, user: PublicUser) {
    const safeCode = this.signalCode(signalCode);
    const signal = await this.repository.assignSignal(
      safeCode,
      user.id,
      resolveHubCountryScope(user),
    );
    if (!signal) {
      throw new ConflictException(
        "Le signal n'existe pas, n'est pas autorisé ou a déjà été assigné.",
      );
    }

    await this.repository.createAudit({
      entityType: 'signal',
      entityId: signal.signalCode,
      action: 'SIGNAL_ASSIGNED',
      actorId: user.id,
      actorType: 'USER',
      metadata: { status: signal.status },
      countryCode: signal.countryCode,
      isDemo: signal.isDemo,
    });
    return { signal: this.presentSignal(signal), simulated: true };
  }

  async decideSignal(
    signalCode: string,
    status: 'VERIFIED' | 'REJECTED',
    note: string,
    user: PublicUser,
  ) {
    const safeCode = this.signalCode(signalCode);
    const decisionNote = note.trim();
    const signal = await this.repository.decideSignal(
      safeCode,
      user.id,
      status,
      decisionNote,
      resolveHubCountryScope(user),
    );
    if (!signal) throw new ConflictException(HUB_SIGNAL_TRANSITION_ERROR);

    const observation = await this.repository.findObservation(
      signal.observationId,
      resolveHubCountryScope(user),
    );
    if (!observation) {
      throw new NotFoundException('Observation linked to the signal not found');
    }

    if (status === 'VERIFIED') {
      await Promise.all([
        this.repository.updateObservationStage(
          observation.canonicalId,
          'verified-alert',
          'critical',
        ),
        this.repository.upsertVerifiedAlert(
          signal,
          observation,
          user.id,
          decisionNote,
        ),
      ]);
    } else {
      await this.repository.updateObservationStage(
        observation.canonicalId,
        'observation',
      );
    }

    await this.repository.createAudit({
      entityType: 'signal',
      entityId: signal.signalCode,
      action: status === 'VERIFIED' ? 'SIGNAL_VERIFIED' : 'SIGNAL_REJECTED',
      actorId: user.id,
      actorType: 'USER',
      metadata: { note: decisionNote, previousStatus: 'UNDER_VERIFICATION' },
      countryCode: signal.countryCode,
      isDemo: signal.isDemo,
    });

    return this.observationDetail(observation.canonicalId, user);
  }

  private presentObservation(observation: HubObservationDocument) {
    return {
      id: observation.canonicalId,
      sourceSystem: observation.sourceSystem,
      sourceRecordId: observation.sourceRecordId,
      sector: observation.sector,
      countryCode: observation.countryCode,
      countryName: observation.countryName,
      adminArea: observation.adminArea,
      latitude: observation.location.coordinates[1],
      longitude: observation.location.coordinates[0],
      observedAt: observation.observedAt,
      receivedAt: observation.receivedAt,
      category: observation.category,
      title: observation.title,
      summary: observation.summary,
      stage: observation.stage,
      severity: observation.severity,
      metrics: observation.metrics.map((metric) => ({
        label: metric.label,
        value: metric.value,
        ...(metric.unit ? { unit: metric.unit } : {}),
      })),
      simulated: observation.isDemo,
      provenance: {
        sourceInstance: observation.sourceInstance,
        sharingPolicyId: observation.sharingPolicyId,
        scenarioId: observation.scenarioId,
        eventCode: observation.eventCode || null,
      },
    };
  }

  private presentSignal(signal: HubSignalDocument) {
    return {
      signalCode: signal.signalCode,
      observationId: signal.observationId,
      riskLevel: signal.riskLevel,
      confidenceScore: signal.confidenceScore,
      explanation: signal.explanation,
      status: signal.status,
      assignedTo: signal.assignedTo?.toString() ?? null,
      detectedAt: signal.detectedAt,
      reviewStartedAt: signal.reviewStartedAt,
      decidedAt: signal.decidedAt,
      decisionNote: signal.decisionNote,
    };
  }

  private presentSharingPolicy(policy: HubSharingPolicyDocument) {
    return {
      policyId: policy.policyId,
      countryOwner: policy.countryOwner,
      sharingLevel: policy.sharingLevel,
      allowedRoles: policy.allowedRoles,
      allowedCountries: policy.allowedCountries,
      aggregationLevel: policy.aggregationLevel,
      retentionPeriodDays: policy.retentionPeriodDays,
      containsPersonalData: policy.containsPersonalData,
      updatedAt: policy.updatedAt,
      simulated: policy.isDemo,
    };
  }

  private normalizeSharingPolicy(dto: UpdateHubSharingPolicyDto) {
    const allowedRoles = Array.from(new Set(dto.allowedRoles));
    let allowedCountries = Array.from(
      new Set(dto.allowedCountries.map((code) => code.toUpperCase())),
    );

    if (
      dto.sharingLevel === 'AUTHORIZED_COUNTRIES' &&
      !allowedCountries.length
    ) {
      throw new BadRequestException(
        'At least one country is required for AUTHORIZED_COUNTRIES',
      );
    }
    if (dto.sharingLevel === 'REGIONAL_AUTHORIZED') {
      allowedCountries = [...CEEAC_COUNTRY_CODES];
    }
    if (
      dto.sharingLevel === 'OWNER_ONLY' ||
      dto.sharingLevel === 'OWNER_AND_CEEAC' ||
      dto.sharingLevel === 'PUBLIC_AGGREGATED'
    ) {
      allowedCountries = [];
    }
    if (
      dto.sharingLevel === 'PUBLIC_AGGREGATED' &&
      (dto.containsPersonalData ||
        !['COUNTRY', 'REGIONAL'].includes(dto.aggregationLevel))
    ) {
      throw new BadRequestException(
        'Public data must exclude personal data and be aggregated at country or regional level',
      );
    }

    return {
      sharingLevel: dto.sharingLevel,
      allowedRoles: dto.sharingLevel === 'OWNER_ONLY' ? [] : allowedRoles,
      allowedCountries,
      aggregationLevel: dto.aggregationLevel,
      retentionPeriodDays: dto.retentionPeriodDays,
      containsPersonalData: dto.containsPersonalData,
    };
  }

  private canonicalId(value: string): string {
    const id = value.trim().toUpperCase();
    if (!/^OBS-(DHIS2|ARIS|CAPC)-[A-Z]{2}-\d{2}$/.test(id)) {
      throw new NotFoundException('Hub observation not found');
    }
    return id;
  }

  private signalCode(value: string): string {
    const code = value.trim().toUpperCase();
    if (!/^SIG-(DHIS2|ARIS|CAPC)-[A-Z]{2}-\d{2}$/.test(code)) {
      throw new NotFoundException('Hub signal not found');
    }
    return code;
  }

  private policyId(value: string): string {
    const id = value.trim().toUpperCase();
    if (!/^POLICY-[A-Z0-9-]{2,80}$/.test(id)) {
      throw new NotFoundException('Hub sharing policy not found');
    }
    return id;
  }
}
