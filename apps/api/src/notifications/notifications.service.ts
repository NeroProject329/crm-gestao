import { Injectable } from '@nestjs/common';

import type {
  NotificationActionResponse,
  NotificationInboxView,
} from '@crm/contracts';

import { DatabaseService } from '../database/database.service';
import type { AuthContext } from '../auth/auth-context';

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async list(auth: AuthContext): Promise<NotificationInboxView> {
    const [recipients, unreadCount] = await this.database.prisma.$transaction([
      this.database.prisma.notificationRecipient.findMany({
        where: { userId: auth.userId },
        include: { notification: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.database.prisma.notificationRecipient.count({
        where: { userId: auth.userId, readAt: null },
      }),
    ]);

    return {
      unreadCount,
      items: recipients.map((recipient) => ({
        id: recipient.notificationId,
        type: recipient.notification.type,
        title: recipient.notification.title,
        message: recipient.notification.message,
        entityType: recipient.notification.entityType,
        entityId: recipient.notification.entityId,
        readAt: recipient.readAt?.toISOString() ?? null,
        createdAt: recipient.notification.createdAt.toISOString(),
      })),
    };
  }

  async markRead(auth: AuthContext, notificationId: string): Promise<NotificationActionResponse> {
    const result = await this.database.prisma.notificationRecipient.updateMany({
      where: { userId: auth.userId, notificationId, readAt: null },
      data: { readAt: new Date() },
    });
    return {
      updated: result.count,
      unreadCount: await this.database.prisma.notificationRecipient.count({
        where: { userId: auth.userId, readAt: null },
      }),
    };
  }

  async markAllRead(auth: AuthContext): Promise<NotificationActionResponse> {
    const result = await this.database.prisma.notificationRecipient.updateMany({
      where: { userId: auth.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count, unreadCount: 0 };
  }
}
