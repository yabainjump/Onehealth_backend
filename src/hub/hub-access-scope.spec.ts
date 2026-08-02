import type { PublicUser } from '../users/interfaces/public-user.interface';
import { HubRole, UserRole } from '../users/schemas/user.schema';
import {
  buildHubCountryFilter,
  resolveHubCountryScope,
} from './hub-access-scope';

describe('Hub country scope', () => {
  it('never lets a requested country replace the authorized scope', () => {
    expect(buildHubCountryFilter(['CM'], 'TD')).toEqual({
      countryCode: { $in: [] },
    });
    expect(buildHubCountryFilter(['CM'], 'CM')).toEqual({ countryCode: 'CM' });
    expect(buildHubCountryFilter(['CM'])).toEqual({
      countryCode: { $in: ['CM'] },
    });
  });

  it('keeps global and Hub administrators unrestricted', () => {
    const globalAdmin = {
      role: UserRole.ADMIN,
      hubRoles: [],
      hubCountryCodes: [],
    } as PublicUser;
    const hubAdmin = {
      role: UserRole.USER,
      hubRoles: [HubRole.ADMIN],
      hubCountryCodes: [],
    } as PublicUser;

    expect(resolveHubCountryScope(globalAdmin)).toBeNull();
    expect(resolveHubCountryScope(hubAdmin)).toBeNull();
  });
});
