import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import type {
  NotificationActionResponse,
  NotificationInboxView,
} from '@crm/contracts';

import type { AuthContext } from '../auth/auth-context';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() auth: AuthContext): Promise<NotificationInboxView> {
    return this.notifications.list(auth);
  }

  @HttpCode(HttpStatus.OK)
  @Post('read-all')
  markAllRead(@CurrentUser() auth: AuthContext): Promise<NotificationActionResponse> {
    return this.notifications.markAllRead(auth);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/read')
  markRead(
    @CurrentUser() auth: AuthContext,
    @Param('id') notificationId: string,
  ): Promise<NotificationActionResponse> {
    return this.notifications.markRead(auth, notificationId);
  }
}
