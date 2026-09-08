import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class NotificationAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: {
        role?: string;
      };
    }>();

    if (request.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}