import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithUser } from '../../users/interfaces/request-with-user.interface';
import { HubRole, UserRole } from '../../users/schemas/user.schema';

@Injectable()
export class HubVerifierGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const canVerify = (user?.hubRoles ?? []).some((role) =>
      [HubRole.VERIFIER, HubRole.ADMIN].includes(role),
    );

    if (user?.role !== UserRole.ADMIN && !canVerify) {
      throw new ForbiddenException('Hub verifier access required');
    }
    return true;
  }
}
