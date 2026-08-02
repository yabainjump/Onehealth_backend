import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HUB_SIGNAL_TRANSITION_ERROR } from '../hub.constants';
import { ListHubObservationsDto } from '../dto/list-hub-observations.dto';
import { resolveHubCountryScope } from '../hub-access-scope';
import { HubRepository } from '../repositories/hub.repository';
import { HubObservationDocument } from '../schemas/hub-observation.schema';
import { HubSignalDocument } from '../schemas/hub-signal.schema';

@Injectable()
export class HubService {
  constructor(private readonly repository: HubRepository) {}

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
    const audit = signal
      ? await this.repository.listAudit(
          signal.signalCode,
          observation.countryCode,
        )
      : [];

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
      simulated: true,
    };
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
}
