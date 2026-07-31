import type {
  ReactNode,
} from 'react';

import {
  AdminShell,
} from '@/components/admin/admin-shell';

interface AdminLayoutProps {
  children:
    ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return (
    <AdminShell>
      {children}
    </AdminShell>
  );
}