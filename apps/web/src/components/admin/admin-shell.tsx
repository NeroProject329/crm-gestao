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
  Megaphone,
  Orbit,
  Settings2,
  UserRound,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';

/* STAGE 13E — RESPONSIVE SHELL */
import {
  Menu,
  X,
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
      '/admin/funcionarios',

    label:
      'Funcionários',

    icon:
      UsersRound,
  },

  {
    href:
      '/admin/ads',

    label:
      'ADS',

    icon:
      Megaphone,
  },

  {
    href:
      '/admin/comprovantes',

    label:
      'Comprovantes',

    icon:
      FileCheck2,
  },

  {
    href:
      '/admin/pagamentos',

    label:
      'Pagamentos',

    icon:
      WalletCards,
  },

  {
    href:
      '/admin/configuracoes',

    label:
      'Configurações',

    icon:
      Settings2,
  },

  {
    href:
      '/admin/conta',

    label:
      'Minha conta',

    icon:
      UserRound,
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
      '/admin/funcionarios',
    )
  ) {
    return {
      eyebrow:
        'Equipe e acessos',

      title:
        'Funcionários',
    };
  }

  if (
    pathname.startsWith(
      '/admin/ads',
    )
  ) {
    return {
      eyebrow:
        'Investimentos e tráfego',

      title:
        'Gestão de ADS',
    };
  }

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

  if (
    pathname.startsWith(
      '/admin/pagamentos',
    )
  ) {
    return {
      eyebrow:
        'Fechamento semanal',

      title:
        'Pagamentos',
    };
  }

  if (
    pathname.startsWith(
      '/admin/configuracoes',
    )
  ) {
    return {
      eyebrow:
        'Políticas e vigências',

      title:
        'Configurações financeiras',
    };
  }

  if (
    pathname.startsWith(
      '/admin/conta',
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

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
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


  useEffect(() => {
    setMobileMenuOpen(false);
  }, [
    pathname,
  ]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleKeyDown = (
      event: KeyboardEvent,
    ): void => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    document.body.style.overflow =
      'hidden';

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    mobileMenuOpen,
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
      <aside
        id="crm-sidebar"
        className={[
          'crm-sidebar',
          mobileMenuOpen
            ? 'is-open'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          className="sidebar-mobile-close"
          aria-label="Fechar menu"
          onClick={() => {
            setMobileMenuOpen(false);
          }}
        >
          <X size={20} />
        </button>
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

        <nav
          className="sidebar-nav"
          aria-label="Navegação administrativa"
        >
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

      <button
        type="button"
        className={[
          'sidebar-overlay',
          mobileMenuOpen
            ? 'is-visible'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Fechar menu"
        tabIndex={
          mobileMenuOpen
            ? 0
            : -1
        }
        onClick={() => {
          setMobileMenuOpen(false);
        }}
      />

      <main
        id="crm-content"
        className="crm-main"
        tabIndex={-1}
      >
        <header className="crm-topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Abrir menu administrativo"
            aria-controls="crm-sidebar"
            aria-expanded={mobileMenuOpen}
            onClick={() => {
              setMobileMenuOpen(true);
            }}
          >
            <Menu size={21} />
          </button>

          <div className="crm-topbar-copy">
            <p>
              {header.eyebrow}
            </p>

            <h1>
              {header.title}
            </h1>
          </div>

          <div className="topbar-actions">
            <Link
              href="/admin/conta#notificacoes"
              className="icon-button"
              aria-label="Notificações"
            >
              <Bell size={19} />
            </Link>

            <Link href="/admin/conta" className="topbar-avatar admin-avatar" aria-label="Minha conta">
              {user.name
                .trim()
                .charAt(
                  0,
                )
                .toUpperCase()}
            </Link>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
