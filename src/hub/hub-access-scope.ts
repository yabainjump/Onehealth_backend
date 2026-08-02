import { ForbiddenException } from '@nestjs/common';
import type { PublicUser } from '../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../users/schemas/user.schema';
import { CEEAC_COUNTRY_CODES } from './hub.constants';

export function resolveHubCountryScope(
  user: PublicUser,
): readonly string[] | null {
  if (
    user.role === UserRole.ADMIN ||
    (user.hubRoles ?? []).includes(HubRole.ADMIN)
  ) {
    return null;
  }

  const allowed = Array.from(
    new Set(
      (user.hubCountryCodes ?? [])
        .map((code) => code.toUpperCase())
        .filter((code) => CEEAC_COUNTRY_CODES.includes(code as never)),
    ),
  );
  if (!allowed.length) {
    throw new ForbiddenException('No Hub country scope configured');
  }
  return allowed;
}

export function buildHubCountryFilter(
  allowedCountryCodes: readonly string[] | null,
  requestedCountryCode?: string,
): Record<string, unknown> {
  if (requestedCountryCode) {
    return allowedCountryCodes &&
      !allowedCountryCodes.includes(requestedCountryCode)
      ? { countryCode: { $in: [] } }
      : { countryCode: requestedCountryCode };
  }
  return allowedCountryCodes
    ? { countryCode: { $in: allowedCountryCodes } }
    : {};
}
