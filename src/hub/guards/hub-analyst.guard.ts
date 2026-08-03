import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithUser } from '../../users/interfaces/request-with-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';

@Injectable()
export class HubAnalystGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    const allowed = (user?.hubRoles ?? []).some((role) =>
      [HubRole.ANALYST, HubRole.VERIFIER, HubRole.ADMIN].includes(role),
    );
    if (user?.role !== UserRole.ADMIN && !allowed) {
      throw new ForbiddenException('Hub analyst access required');
    }
    return true;
  }
}
