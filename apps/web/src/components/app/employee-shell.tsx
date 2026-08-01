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
  ChartNoAxesCombined,
  FileCheck2,
  LogOut,
  Orbit,
  ReceiptText,
  UserRound,
  WalletCards,
} from 'lucide-react';

import type {
  AuthenticatedUserView,
} from '@crm/contracts';

import {
  ApiError,
  apiRequest,
} from '@/lib/api';

interface EmployeeShellProps {
  children:
    React.ReactNode;
}

const navigation = [
  {
    href:
      '/app/dashboard',

    label:
      'Visão geral',

    icon:
      ChartNoAxesCombined,
  },

  {
    href:
      '/app/financeiro',

    label:
      'Financeiro',

    icon:
      WalletCards,
  },

  {
    href:
      '/app/comprovantes',

    label:
      'Comprovantes',

    icon:
      FileCheck2,
  },

  {
    href:
      '/app/pagamentos',

    label:
      'Pagamentos',

    icon:
      ReceiptText,
  },

  {
    href:
      '/app/conta',

    label:
      'Minha conta',

    icon:
      UserRound,
  },
] as const;

function titleForPath(
  pathname: string,
): {
  eyebrow: string;
  title: string;
} {
  if (
    pathname.startsWith(
      '/app/financeiro',
    )
  ) {
    return {
      eyebrow:
        'Sua operação',

      title:
        'Financeiro',
    };
  }

  if (
    pathname.startsWith(
      '/app/comprovantes',
    )
  ) {
    return {
      eyebrow:
        'Recebimentos',

      title:
        'Comprovantes',
    };
  }

  if (
    pathname.startsWith(
      '/app/pagamentos',
    )
  ) {
    return {
      eyebrow:
        'Fechamento',

      title:
        'Pagamentos',
    };
  }

  if (
    pathname.startsWith(
      '/app/conta',
    )
  ) {
    return {
      eyebrow:
        'Perfil e segurança',

      title:
        'Minha conta',
    };
  }

  return {
    eyebrow:
      'Visão individual',

    title:
      'Dashboard',
  };
}

export function EmployeeShell({
  children,
}: EmployeeShellProps) {
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
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    logoutLoading,
    setLogoutLoading,
  ] =
    useState(false);

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

  useEffect(
    () => {
      let active =
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

          if (!active) {
            return;
          }

          if (
            currentUser.role !==
              'EMPLOYEE' ||
            !currentUser.employeeId
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
          if (active) {
            setLoading(
              false,
            );
          }
        }
      }

      void loadSession();

      return () => {
        active = false;
      };
    },
    [
      router,
    ],
  );

  async function logout():
    Promise<void> {
    setLogoutLoading(true);

    try {
      await apiRequest<void>(
        '/auth/logout',
        {
          method:
            'POST',
        },
      );
    } catch {
      // Mesmo se a sessão já estiver inválida,
      // removemos o usuário da interface.
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
    <div className="crm-shell">
      <aside className="crm-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Orbit
              size={22}
            />
          </div>

          <strong>
            CRM Gestão
          </strong>
        </div>

        <p className="sidebar-label">
          Navegação
        </p>

        <nav className="sidebar-nav">
          {
            navigation.map(
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

                    className={
                      [
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
                        )
                    }
                  >
                    <Icon
                      size={
                        19
                      }
                    />

                    <span>
                      {
                        label
                      }
                    </span>
                  </Link>
                );
              },
            )
          }
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <p className="user-chip-name">
              {
                user.name
              }
            </p>

            <p className="user-chip-email">
              {
                user.email
              }
            </p>
          </div>

          <button
            type="button"

            className="logout-button"

            onClick={
              () => {
                void logout();
              }
            }

            disabled={
              logoutLoading
            }
          >
            <LogOut
              size={17}
            />

            <span>
              {
                logoutLoading
                  ? 'Saindo...'
                  : 'Sair'
              }
            </span>
          </button>
        </div>
      </aside>

      <main className="crm-main">
        <header
          className="crm-topbar"

          data-motion="page-header"
        >
          <div className="crm-topbar-copy">
            <p>
              {
                header.eyebrow
              }
            </p>

            <h1>
              {
                header.title
              }
            </h1>
          </div>

          <div className="topbar-actions">
            <Link
              href="/app/conta#notificacoes"
              className="icon-button"
              aria-label="Notificações"
            >
              <Bell size={19} />
            </Link>

            <Link href="/app/conta" className="topbar-avatar" aria-label="Minha conta">
              {
                user.name
                  .trim()
                  .charAt(0)
                  .toUpperCase()
              }
            </Link>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}