import { UserRole } from '../../users/schemas/user.schema';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Date d'emission (secondes epoch), ajoutee par `@nestjs/jwt`. */
  iat?: number;
}
