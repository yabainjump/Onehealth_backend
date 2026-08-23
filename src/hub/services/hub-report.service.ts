import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';
import type { HubReportStatus } from '../hub.constants';
import { resolveHubCountryScope } from '../hub-access-scope';
import { HubRepository } from '../repositories/hub.repository';
import type { HubAlertReportDocument } from '../schemas/hub-alert-report.schema';

@Injectable()
export class HubReportService {
  constructor(private readonly repository: HubRepository) {}

  async list(observationId: string, user: PublicUser) {
    const observation = await this.authorizedObservation(observationId, user);
    const alert = await this.repository.findAlertByObservation(
      observation.canonicalId,
    );
    if (!alert) return { items: [], total: 0, simulated: true };
    const reports = await this.repository.listReports(
      alert.alertCode,
      observation.countryCode,
    );
    return {
      items: reports.map((report) => this.present(report)),
      total: reports.length,
      simulated: reports.every((report) => report.isDemo),
    };
  }

  async generate(observationId: string, user: PublicUser) {
    const observation = await this.authorizedObservation(observationId, user);
    const alert = await this.repository.findAlertByObservation(
      observation.canonicalId,
    );
    if (!alert || alert.status !== 'VERIFIED') {
      throw new ConflictException(
        'Un rapport ne peut être généré que pour une alerte vérifiée.',
      );
    }
    const related = await this.repository.relatedObservations(
      observation,
      resolveHubCountryScope(user),
      12,
    );
    const dossier = [observation, ...related];
    const latest = await this.repository.latestReport(alert.alertCode);
    const version = (latest?.version ?? 0) + 1;
    const sectors = Array.from(new Set(dossier.map((item) => item.sector)));
    const report = await this.repository.createReport({
      reportId: `RPT-${alert.alertCode}-V${version}`,
      alertCode: alert.alertCode,
      observationId: observation.canonicalId,
      countryCode: observation.countryCode,
      version,
      status: 'DRAFT',
      title: `Rapport One Health — ${observation.title}`,
      executiveSummary:
        `${alert.summary} Ce rapport consolide ${dossier.length} observation(s) ` +
        `provenant de ${sectors.length} secteur(s). Il reste soumis au workflow de validation humaine du Hub CEEAC.`,
      findings: dossier
        .slice(0, 8)
        .map(
          (item) =>
            `${item.countryName}, ${item.adminArea} — ${item.title} (${item.sourceSystem}, risque ${item.severity}).`,
        ),
      recommendations: [
        'Confirmer les données avec les points focaux nationaux concernés.',
        'Mettre en place une investigation conjointe humaine–animale–environnementale.',
        'Renforcer la surveillance dans les zones limitrophes et partager les résultats selon les politiques de souveraineté.',
      ],
      sources: Array.from(new Set(dossier.map((item) => item.sourceSystem))),
      sectors,
      generatedBy: user.id,
      generatedAt: new Date(),
      isDemo: dossier.every((item) => item.isDemo),
    });
    await this.repository.createAudit({
      entityType: 'report',
      entityId: report.reportId,
      action: 'REPORT_VERSION_GENERATED',
      actorId: user.id,
      actorType: 'USER',
      metadata: {
        alertCode: alert.alertCode,
        observationId: observation.canonicalId,
        version,
      },
      countryCode: observation.countryCode,
      isDemo: report.isDemo,
    });
    return this.present(report);
  }

  async transition(
    reportId: string,
    target: Exclude<HubReportStatus, 'DRAFT'>,
    user: PublicUser,
  ) {
    const safeId = this.reportId(reportId);
    const report = await this.repository.findReport(
      safeId,
      resolveHubCountryScope(user),
    );
    if (!report) throw new NotFoundException('Hub report not found');

    const expected: Record<
      Exclude<HubReportStatus, 'PUBLISHED'>,
      HubReportStatus
    > = {
      DRAFT: 'IN_REVIEW',
      IN_REVIEW: 'VALIDATED',
      VALIDATED: 'PUBLISHED',
    };
    if (report.status === 'PUBLISHED' || expected[report.status] !== target) {
      throw new ConflictException(
        `Transition de ${report.status} vers ${target} refusée.`,
      );
    }
    this.assertTransitionRole(target, user);
    const updated = await this.repository.updateReportStatus(
      safeId,
      report.status,
      target,
      user.id,
      resolveHubCountryScope(user),
    );
    if (!updated)
      throw new ConflictException(
        'Le rapport a été modifié par un autre utilisateur.',
      );
    await this.repository.createAudit({
      entityType: 'report',
      entityId: updated.reportId,
      action: `REPORT_${target}`,
      actorId: user.id,
      actorType: 'USER',
      metadata: {
        from: report.status,
        to: target,
        alertCode: updated.alertCode,
      },
      countryCode: updated.countryCode,
      isDemo: updated.isDemo,
    });
    return this.present(updated);
  }

  private async authorizedObservation(observationId: string, user: PublicUser) {
    const id = observationId.trim().toUpperCase();
    if (!/^OBS-(DHIS2|ARIS|CAPC)-[A-Z]{2}-\d{2}$/.test(id)) {
      throw new NotFoundException('Hub observation not found');
    }
    const observation = await this.repository.findObservation(
      id,
      resolveHubCountryScope(user),
    );
    if (!observation) throw new NotFoundException('Hub observation not found');
    return observation;
  }

  private assertTransitionRole(target: HubReportStatus, user: PublicUser) {
    const isAppAdmin = user.role === UserRole.ADMIN;
    const roles = user.hubRoles ?? [];
    const allowed =
      target === 'IN_REVIEW'
        ? roles.some((role) =>
            [HubRole.ANALYST, HubRole.VERIFIER, HubRole.ADMIN].includes(role),
          )
        : target === 'VALIDATED'
          ? roles.some((role) =>
              [HubRole.VERIFIER, HubRole.ADMIN].includes(role),
            )
          : roles.includes(HubRole.ADMIN);
    if (!isAppAdmin && !allowed)
      throw new ForbiddenException(
        'Rôle Hub insuffisant pour cette transition.',
      );
  }

  private reportId(value: string) {
    const id = value.trim().toUpperCase();
    if (!/^RPT-ALT-(DHIS2|ARIS|CAPC)-[A-Z]{2}-\d{2}-V\d+$/.test(id)) {
      throw new NotFoundException('Hub report not found');
    }
    return id;
  }

  private present(report: HubAlertReportDocument) {
    return {
      reportId: report.reportId,
      alertCode: report.alertCode,
      observationId: report.observationId,
      countryCode: report.countryCode,
      version: report.version,
      status: report.status,
      title: report.title,
      executiveSummary: report.executiveSummary,
      findings: report.findings,
      recommendations: report.recommendations,
      sources: report.sources,
      sectors: report.sectors,
      generatedBy: report.generatedBy,
      generatedAt: report.generatedAt,
      validatedBy: report.validatedBy || null,
      validatedAt: report.validatedAt,
      publishedBy: report.publishedBy || null,
      publishedAt: report.publishedAt,
      simulated: report.isDemo,
    };
  }
}
