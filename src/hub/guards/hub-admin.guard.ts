import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithUser } from '../../users/interfaces/request-with-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';

@Injectable()
export class HubAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const isAdmin =
      user?.role === UserRole.ADMIN ||
      (user?.hubRoles ?? []).includes(HubRole.ADMIN);

    if (!isAdmin) {
      throw new ForbiddenException('Hub administrator access required');
    }
    return true;
  }
}
