'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link
  from 'next/link';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  Bell,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Orbit,
  ShieldCheck,
} from 'lucide-react';

import type {
  AuthenticatedUserView,
} from '@crm/contracts';

import {
  ApiError,
  apiRequest,
} from '@/lib/api';

interface AdminShellProps {
  children:
    React.ReactNode;
}

const navigation = [
  {
    href:
      '/admin/dashboard',

    label:
      'Dashboard',

    icon:
      LayoutDashboard,
  },

  {
    href:
      '/admin/comprovantes',

    label:
      'Comprovantes',

    icon:
      FileCheck2,
  },
] as const;

function titleForPath(
  pathname:
    string,
): {
  eyebrow:
    string;

  title:
    string;
} {
  if (
    pathname.startsWith(
      '/admin/comprovantes',
    )
  ) {
    return {
      eyebrow:
        'Recebimentos',

      title:
        'Comprovantes',
    };
  }

  return {
    eyebrow:
      'Central administrativa',

    title:
      'Dashboard',
  };
}

export function AdminShell({
  children,
}: AdminShellProps) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<
      AuthenticatedUserView |
      null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    logoutLoading,
    setLogoutLoading,
  ] =
    useState(
      false,
    );

  const header =
    useMemo(
      () =>
        titleForPath(
          pathname,
        ),
      [
        pathname,
      ],
    );

  useEffect(() => {
    let mounted =
      true;

    async function loadSession():
      Promise<void> {
      try {
        const currentUser =
          await apiRequest<
            AuthenticatedUserView
          >(
            '/auth/me',
          );

        if (!mounted) {
          return;
        }

        if (
          currentUser.role ===
          'EMPLOYEE'
        ) {
          router.replace(
            '/app/dashboard',
          );

          return;
        }

        if (
          currentUser.role !==
          'ADMIN'
        ) {
          router.replace(
            '/login',
          );

          return;
        }

        setUser(
          currentUser,
        );
      } catch (
        error
      ) {
        if (
          error instanceof
            ApiError &&
          (
            error.status ===
              401 ||
            error.status ===
              403
          )
        ) {
          router.replace(
            '/login',
          );

          return;
        }

        router.replace(
          '/login',
        );
      } finally {
        if (
          mounted
        ) {
          setLoading(
            false,
          );
        }
      }
    }

    void loadSession();

    return () => {
      mounted =
        false;
    };
  }, [
    router,
  ]);

  async function logout():
    Promise<void> {
    setLogoutLoading(
      true,
    );

    try {
      await apiRequest<void>(
        '/auth/logout',
        {
          method:
            'POST',
        },
      );
    } catch {
      // Sessão pode já ter expirado.
    } finally {
      router.replace(
        '/login',
      );

      router.refresh();
    }
  }

  if (
    loading ||
    !user
  ) {
    return (
      <main className="dashboard-loading">
        <div className="loading-ring" />
      </main>
    );
  }

  return (
    <div className="crm-shell admin-crm-shell">
      <aside className="crm-sidebar">
        <div className="sidebar-brand admin-sidebar-brand">
          <div className="sidebar-logo">
            <Orbit
              size={22}
            />
          </div>

          <div>
            <strong>
              CRM Gestão
            </strong>

            <span className="admin-role-badge">
              <ShieldCheck
                size={11}
              />

              ADMIN
            </span>
          </div>
        </div>

        <p className="sidebar-label">
          Administração
        </p>

        <nav className="sidebar-nav">
          {navigation.map(
            ({
              href,
              label,
              icon:
                Icon,
            }) => {
              const active =
                pathname ===
                  href ||
                pathname
                  .startsWith(
                    `${href}/`,
                  );

              return (
                <Link
                  key={
                    href
                  }
                  href={
                    href
                  }
                  className={[
                    'sidebar-link',
                    active
                      ? 'active'
                      : '',
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ' ',
                    )}
                >
                  <Icon
                    size={
                      19
                    }
                  />

                  <span>
                    {label}
                  </span>
                </Link>
              );
            },
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <p className="user-chip-name">
              {user.name}
            </p>

            <p className="user-chip-email">
              {user.email}
            </p>
          </div>

          <button
            type="button"
            className="logout-button"
            disabled={
              logoutLoading
            }
            onClick={() => {
              void logout();
            }}
          >
            <LogOut
              size={17}
            />

            <span>
              {logoutLoading
                ? 'Saindo...'
                : 'Sair'}
            </span>
          </button>
        </div>
      </aside>

      <main className="crm-main">
        <header className="crm-topbar">
          <div className="crm-topbar-copy">
            <p>
              {header.eyebrow}
            </p>

            <h1>
              {header.title}
            </h1>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Notificações"
            >
              <Bell
                size={19}
              />
            </button>

            <div className="topbar-avatar admin-avatar">
              {user.name
                .trim()
                .charAt(
                  0,
                )
                .toUpperCase()}
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}