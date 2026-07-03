import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../users/schemas/user.schema';
import type { RequestWithUser } from '../../users/interfaces/request-with-user.interface';

/**
 * Restreint une route aux administrateurs. À utiliser APRÈS JwtAuthGuard
 * (qui remplit request.user) : @UseGuards(JwtAuthGuard, AdminGuard).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
