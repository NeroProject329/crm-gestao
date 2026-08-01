export interface AccountSessionView {
  id: string;
  current: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface AccountSessionActionResponse {
  revokedSessions: number;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationInboxView {
  items: NotificationView[];
  unreadCount: number;
}

export interface NotificationActionResponse {
  updated: number;
  unreadCount: number;
}
