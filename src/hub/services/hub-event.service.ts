import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { resolveHubCountryScope } from '../hub-access-scope';
import { HubRepository } from '../repositories/hub.repository';
import type { HubEventDocument } from '../schemas/hub-event.schema';
import type { HubObservationDocument } from '../schemas/hub-observation.schema';

const CORRELATION_RULE_VERSION = 'CEEAC-SPATIOTEMPORAL-1.0';

@Injectable()
export class HubEventService {
  constructor(private readonly repository: HubRepository) {}

  async list(user: PublicUser) {
    const events = await this.repository.listEvents(
      resolveHubCountryScope(user),
    );
    return {
      items: events.map((event) => this.present(event, user)),
      total: events.length,
      simulated: events.every((event) => event.isDemo),
    };
  }

  async detail(eventCode: string, user: PublicUser) {
    const code = this.eventCode(eventCode);
    const scope = resolveHubCountryScope(user);
    const event = await this.repository.findEvent(code, scope);
    if (!event) throw new NotFoundException('Hub consolidated event not found');
    const observations = await this.repository.findObservationsByIds(
      event.observationIds,
      scope,
    );
    return {
      ...this.present(event, user),
      observationIds: observations.map((item) => item.canonicalId),
      observations: observations.map((item) => this.presentObservation(item)),
    };
  }

  async consolidate(
    observationIds: readonly string[],
    user: PublicUser,
    scenarioId?: string,
  ) {
    const uniqueIds = Array.from(
      new Set(observationIds.map((id) => id.trim().toUpperCase())),
    );
    if (uniqueIds.length < 2) {
      throw new BadRequestException(
        'At least two distinct observations are required',
      );
    }
    const scope = scenarioId ? null : resolveHubCountryScope(user);
    const observations = await this.repository.findObservationsByIds(
      uniqueIds,
      scope,
    );
    if (observations.length !== uniqueIds.length) {
      throw new NotFoundException(
        'One or more Hub observations are unavailable in your scope',
      );
    }

    const correlation = this.correlate(observations);
    if (correlation.sectors.length < 2) {
      throw new BadRequestException(
        'A consolidated One Health event requires at least two sectors',
      );
    }
    if (correlation.score < 0.55) {
      throw new BadRequestException(
        `Correlation score too low (${correlation.score}) to consolidate these observations`,
      );
    }

    const digest = createHash('sha256')
      .update(uniqueIds.slice().sort().join('|'))
      .digest('hex')
      .slice(0, 8)
      .toUpperCase();
    const eventCode = `EVT-${correlation.countries.join('-')}-${digest}`;
    const conflictingObservation = observations.find(
      (item) => item.eventCode && item.eventCode !== eventCode,
    );
    if (conflictingObservation) {
      throw new ConflictException(
        `${conflictingObservation.canonicalId} already belongs to ${conflictingObservation.eventCode}`,
      );
    }
    const now = new Date();
    const event = await this.repository.upsertEvent({
      eventCode,
      title: this.titleFor(observations, correlation.countries),
      status: 'CONSOLIDATED',
      observationIds: uniqueIds,
      countryCodes: correlation.countries,
      sectors: correlation.sectors,
      center: { type: 'Point', coordinates: correlation.center },
      maxDistanceKm: correlation.maxDistanceKm,
      timeWindowHours: correlation.timeWindowHours,
      correlationScore: correlation.score,
      correlationReasons: correlation.reasons,
      ruleVersion: CORRELATION_RULE_VERSION,
      scenarioId: scenarioId ?? `MANUAL-${digest}`,
      firstObservedAt: correlation.firstObservedAt,
      lastObservedAt: correlation.lastObservedAt,
      consolidatedBy: user.id,
      consolidatedAt: now,
      isDemo: observations.every((item) => item.isDemo),
    });
    if (!event) throw new Error('Hub event consolidation failed');

    await Promise.all([
      this.repository.assignEventToObservations(uniqueIds, event.eventCode),
      this.repository.createAudit({
        entityType: 'event',
        entityId: event.eventCode,
        action: 'OBSERVATIONS_CONSOLIDATED',
        actorId: user.id,
        actorType: scenarioId ? 'SYSTEM' : 'USER',
        metadata: {
          observationIds: uniqueIds,
          correlationScore: correlation.score,
          reasons: correlation.reasons,
          ruleVersion: CORRELATION_RULE_VERSION,
        },
        countryCode: correlation.countries[0],
        isDemo: event.isDemo,
      }),
    ]);
    return this.present(event, user);
  }

  private correlate(observations: readonly HubObservationDocument[]) {
    const sectors = Array.from(
      new Set(observations.map((item) => item.sector)),
    ).sort();
    const countries = Array.from(
      new Set(observations.map((item) => item.countryCode)),
    ).sort();
    const dates = observations.map((item) => item.observedAt.getTime());
    const firstObservedAt = new Date(Math.min(...dates));
    const lastObservedAt = new Date(Math.max(...dates));
    const timeWindowHours = this.round(
      (lastObservedAt.getTime() - firstObservedAt.getTime()) / 3_600_000,
    );
    let maxDistanceKm = 0;
    for (let left = 0; left < observations.length; left += 1) {
      for (let right = left + 1; right < observations.length; right += 1) {
        maxDistanceKm = Math.max(
          maxDistanceKm,
          this.distanceKm(observations[left], observations[right]),
        );
      }
    }
    maxDistanceKm = this.round(maxDistanceKm);
    const center: [number, number] = [
      this.round(
        observations.reduce(
          (sum, item) => sum + item.location.coordinates[0],
          0,
        ) / observations.length,
      ),
      this.round(
        observations.reduce(
          (sum, item) => sum + item.location.coordinates[1],
          0,
        ) / observations.length,
      ),
    ];

    const sectorPoints =
      sectors.length >= 3 ? 0.35 : sectors.length === 2 ? 0.22 : 0.05;
    const timePoints =
      timeWindowHours <= 24 ? 0.25 : timeWindowHours <= 72 ? 0.15 : 0.05;
    const spacePoints =
      maxDistanceKm <= 100 ? 0.25 : maxDistanceKm <= 300 ? 0.15 : 0.05;
    const borderPoints = countries.length > 1 ? 0.15 : 0.08;
    const score = this.round(
      sectorPoints + timePoints + spacePoints + borderPoints,
    );
    const reasons = [
      `${sectors.length} secteurs distincts rapprochés : ${sectors.join(', ')}.`,
      `Fenêtre temporelle de ${timeWindowHours} heure(s).`,
      `Distance maximale de ${maxDistanceKm} km entre les observations.`,
      countries.length > 1
        ? `Convergence transfrontalière entre ${countries.join(' et ')}.`
        : `Convergence observée dans le pays ${countries[0]}.`,
      `Score calculé par la règle ${CORRELATION_RULE_VERSION}, sans validation automatique.`,
    ];
    return {
      sectors,
      countries,
      firstObservedAt,
      lastObservedAt,
      timeWindowHours,
      maxDistanceKm,
      center,
      score,
      reasons,
    };
  }

  private distanceKm(
    left: HubObservationDocument,
    right: HubObservationDocument,
  ) {
    const radians = (value: number) => (value * Math.PI) / 180;
    const [leftLon, leftLat] = left.location.coordinates;
    const [rightLon, rightLat] = right.location.coordinates;
    const latDelta = radians(rightLat - leftLat);
    const lonDelta = radians(rightLon - leftLon);
    const a =
      Math.sin(latDelta / 2) ** 2 +
      Math.cos(radians(leftLat)) *
        Math.cos(radians(rightLat)) *
        Math.sin(lonDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private present(event: HubEventDocument, user: PublicUser) {
    const scope = resolveHubCountryScope(user);
    const visibleCountries = scope
      ? event.countryCodes.filter((country) => scope.includes(country))
      : event.countryCodes;
    return {
      eventCode: event.eventCode,
      title: event.title,
      status: event.status,
      observationIds: scope ? [] : event.observationIds,
      countryCodes: visibleCountries,
      sectors: event.sectors,
      longitude: event.center.coordinates[0],
      latitude: event.center.coordinates[1],
      maxDistanceKm: event.maxDistanceKm,
      timeWindowHours: event.timeWindowHours,
      correlationScore: event.correlationScore,
      correlationReasons: event.correlationReasons,
      ruleVersion: event.ruleVersion,
      scenarioId: event.scenarioId,
      firstObservedAt: event.firstObservedAt,
      lastObservedAt: event.lastObservedAt,
      consolidatedBy: event.consolidatedBy,
      consolidatedAt: event.consolidatedAt,
      simulated: event.isDemo,
    };
  }

  private presentObservation(item: HubObservationDocument) {
    return {
      id: item.canonicalId,
      title: item.title,
      sector: item.sector,
      sourceSystem: item.sourceSystem,
      countryCode: item.countryCode,
      countryName: item.countryName,
      adminArea: item.adminArea,
      observedAt: item.observedAt,
      severity: item.severity,
      simulated: item.isDemo,
    };
  }

  private titleFor(
    observations: readonly HubObservationDocument[],
    countries: readonly string[],
  ) {
    return `Événement One Health consolidé ${countries.join('–')} — ${observations[0].category}`;
  }

  private eventCode(value: string) {
    const code = value.trim().toUpperCase();
    if (!/^EVT-[A-Z0-9-]{6,80}$/.test(code)) {
      throw new NotFoundException('Hub consolidated event not found');
    }
    return code;
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }
}
