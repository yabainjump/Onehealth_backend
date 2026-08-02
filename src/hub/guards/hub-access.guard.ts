import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithUser } from '../../users/interfaces/request-with-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';

@Injectable()
export class HubAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const hasHubRole = (user?.hubRoles ?? []).some((role) =>
      Object.values(HubRole).includes(role),
    );

    if (user?.role !== UserRole.ADMIN && !hasHubRole) {
      throw new ForbiddenException('Hub access required');
    }
    return true;
  }
}
