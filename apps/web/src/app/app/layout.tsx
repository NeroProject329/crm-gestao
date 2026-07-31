import {
  EmployeeShell,
} from '@/components/app/employee-shell';

interface AppLayoutProps {
  children:
    React.ReactNode;
}

export default function AppLayout({
  children,
}: AppLayoutProps) {
  return (
    <EmployeeShell>
      {children}
    </EmployeeShell>
  );
}