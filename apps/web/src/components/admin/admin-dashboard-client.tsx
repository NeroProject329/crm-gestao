'use client';

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  FileClock,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';

import {
  gsap,
} from 'gsap';

import type {
  AdminDashboardView,
  DashboardPreset,
  EmployeeFinancialStatus,
} from '@crm/contracts';

import {
  apiRequest,
} from '@/lib/api';

import {
  formatBRL,
  formatBusinessDate,
} from '@/lib/format';

import {
  AdminFinancialChart,
} from './admin-financial-chart';

const PRESETS: Array<{
  value:
    DashboardPreset;

  label:
    string;
}> = [
  {
    value:
      'TODAY',

    label:
      'Hoje',
  },

  {
    value:
      'WEEK',

    label:
      'Semana',
  },

  {
    value:
      'MONTH',

    label:
      'Mês',
  },

  {
    value:
      'YEAR',

    label:
      'Ano',
  },

  {
    value:
      'CUSTOM',

    label:
      'Período',
  },
];

function localDate():
  string {
  const now =
    new Date();

  const offset =
    now
      .getTimezoneOffset();

  return new Date(
    now.getTime() -
      offset *
        60_000,
  )
    .toISOString()
    .slice(
      0,
      10,
    );
}

function statusLabel(
  status:
    EmployeeFinancialStatus,
): string {
  switch (
    status
  ) {
    case 'POSITIVE':
      return 'Positivo';

    case 'ADS_DEBT':
      return 'Dívida ADS';

    default:
      return 'Zerado';
  }
}

export function AdminDashboardClient() {
  const [
    data,
    setData,
  ] =
    useState<
      AdminDashboardView |
      null
    >(
      null,
    );

  const [
    preset,
    setPreset,
  ] =
    useState<
      DashboardPreset
    >(
      'MONTH',
    );

  const [
    customFrom,
    setCustomFrom,
  ] =
    useState(
      localDate(),
    );

  const [
    customTo,
    setCustomTo,
  ] =
    useState(
      localDate(),
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      '',
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  useLayoutEffect(() => {
    const reduced =
      window
        .matchMedia(
          '(prefers-reduced-motion: reduce)',
        )
        .matches;

    if (reduced) {
      return;
    }

    const context =
      gsap.context(
        () => {
          gsap.fromTo(
            '.admin-reveal',
            {
              opacity:
                0,

              y:
                22,
            },
            {
              opacity:
                1,

              y:
                0,

              stagger:
                0.055,

              duration:
                0.65,

              ease:
                'power3.out',
            },
          );
        },
      );

    return () => {
      context.revert();
    };
  }, []);

  const load =
    useCallback(
      async (
        nextPreset:
          DashboardPreset,

        from?:
          string,

        to?:
          string,
      ) => {
        setLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const params =
            new URLSearchParams();

          params.set(
            'preset',
            nextPreset,
          );

          if (
            nextPreset ===
            'CUSTOM'
          ) {
            if (
              !from ||
              !to
            ) {
              throw new Error(
                'Informe a data inicial e final.',
              );
            }

            params.set(
              'from',
              from,
            );

            params.set(
              'to',
              to,
            );
          }

          const result =
            await apiRequest<
              AdminDashboardView
            >(
              `/admin/dashboard?${params.toString()}`,
            );

          setData(
            result,
          );
        } catch (
          cause
        ) {
          setError(
            cause instanceof
              Error
              ? cause.message
              : 'Não foi possível carregar o dashboard administrativo.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useLayoutEffect(() => {
    void load(
      'MONTH',
    );
  }, [
    load,
  ]);

  const employees =
    useMemo(
      () => {
        if (!data) {
          return [];
        }

        const query =
          search
            .trim()
            .toLocaleLowerCase(
              'pt-BR',
            );

        if (!query) {
          return data
            .employees;
        }

        return data
          .employees
          .filter(
            (
              employee,
            ) =>
              employee
                .name
                .toLocaleLowerCase(
                  'pt-BR',
                )
                .includes(
                  query,
                ) ||
              employee
                .email
                .toLocaleLowerCase(
                  'pt-BR',
                )
                .includes(
                  query,
                ),
          );
      },
      [
        data,
        search,
      ],
    );

  async function changePreset(
    next:
      DashboardPreset,
  ): Promise<void> {
    setPreset(
      next,
    );

    if (
      next ===
      'CUSTOM'
    ) {
      return;
    }

    await load(
      next,
    );
  }

  async function applyCustom():
    Promise<void> {
    setPreset(
      'CUSTOM',
    );

    await load(
      'CUSTOM',
      customFrom,
      customTo,
    );
  }

  if (
    loading &&
    !data
  ) {
    return (
      <div className="finance-loading-state">
        <RefreshCw
          size={28}
          className="spin"
        />

        Carregando central administrativa...
      </div>
    );
  }

  return (
    <section className="admin-dashboard-page">
      {/* =================================================
          HERO
      ================================================= */}

      <header className="admin-dashboard-hero admin-reveal">
        <div>
          <span className="section-kicker">
            COMMAND CENTER
          </span>

          <h1>
            Visão geral
            <br />
            da operação.
          </h1>

          <p>
            Faturamento, custos, lucro
            administrativo, dívida e desempenho
            de cada funcionário em uma única visão.
          </p>
        </div>

        {data ? (
          <div className="admin-operation-stats">
            <div>
              <Users
                size={19}
              />

              <span>
                Funcionários ativos
              </span>

              <strong>
                {data.summary.activeEmployees}
                {' / '}
                {data.summary.totalEmployees}
              </strong>
            </div>

            <div>
              <FileClock
                size={19}
              />

              <span>
                Comprovantes pendentes
              </span>

              <strong>
                {data.summary.pendingReceipts}
              </strong>
            </div>
          </div>
        ) : null}
      </header>

      {/* =================================================
          PERIOD FILTER
      ================================================= */}

      <div className="finance-filter-panel admin-reveal">
        <div className="finance-preset-list">
          {PRESETS.map(
            (
              item,
            ) => (
              <button
                key={
                  item.value
                }
                type="button"
                className={
                  preset ===
                  item.value
                    ? 'finance-preset active'
                    : 'finance-preset'
                }
                onClick={() => {
                  void changePreset(
                    item.value,
                  );
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>

        {preset ===
        'CUSTOM' ? (
          <div className="finance-custom-period">
            <label>
              <span>
                De
              </span>

              <input
                type="date"
                value={
                  customFrom
                }
                onChange={(
                  event,
                ) => {
                  setCustomFrom(
                    event
                      .target
                      .value,
                  );
                }}
              />
            </label>

            <label>
              <span>
                Até
              </span>

              <input
                type="date"
                value={
                  customTo
                }
                onChange={(
                  event,
                ) => {
                  setCustomTo(
                    event
                      .target
                      .value,
                  );
                }}
              />
            </label>

            <button
              type="button"
              className="finance-apply-button"
              disabled={
                loading
              }
              onClick={() => {
                void applyCustom();
              }}
            >
              Aplicar
            </button>
          </div>
        ) : data ? (
          <div className="admin-period-label">
            <CalendarDays
              size={17}
            />

            {formatBusinessDate(
              data
                .period
                .from,
            )}

            <span>
              —
            </span>

            {formatBusinessDate(
              data
                .period
                .to,
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="dashboard-error admin-reveal">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          {/* ===============================================
              SUMMARY
          =============================================== */}

          <div className="admin-summary-grid">
            <article className="admin-summary-card admin-reveal">
              <div className="admin-summary-icon">
                <TrendingUp
                  size={21}
                />
              </div>

              <span>
                Faturamento aprovado
              </span>

              <strong>
                {formatBRL(
                  data.summary
                    .approvedRevenue,
                )}
              </strong>

              <small>
                Receita oficial do período
              </small>
            </article>

            <article className="admin-summary-card admin-reveal">
              <div className="admin-summary-icon">
                <CreditCard
                  size={21}
                />
              </div>

              <span>
                Custo bancário
              </span>

              <strong>
                {formatBRL(
                  data.summary
                    .bankCost,
                )}
              </strong>

              <small>
                Custo consolidado do banco
              </small>
            </article>

            <article className="admin-summary-card admin-reveal">
              <div className="admin-summary-icon">
                <Banknote
                  size={21}
                />
              </div>

              <span>
                ADS
              </span>

              <strong>
                {formatBRL(
                  data.summary
                    .adsCost,
                )}
              </strong>

              <small>
                Investimento total em anúncios
              </small>
            </article>

            <article className="admin-summary-card admin-reveal">
              <div className="admin-summary-icon">
                <WalletCards
                  size={21}
                />
              </div>

              <span>
                Custo funcionários
              </span>

              <strong>
                {formatBRL(
                  data.summary
                    .employeeAmount,
                )}
              </strong>

              <small>
                Employee amount consolidado
              </small>
            </article>

            <article className="admin-summary-card profit admin-reveal">
              <div className="admin-summary-icon">
                <ShieldCheck
                  size={21}
                />
              </div>

              <span>
                Lucro administrativo
              </span>

              <strong>
                {formatBRL(
                  data.summary
                    .adminProfit,
                )}
              </strong>

              <small>
                Parcela administrativa do resultado
              </small>
            </article>

            <article className="admin-summary-card debt admin-reveal">
              <div className="admin-summary-icon">
                <CircleDollarSign
                  size={21}
                />
              </div>

              <span>
                Dívida ADS atual
              </span>

              <strong>
                {formatBRL(
                  data.summary
                    .currentAdsDebt,
                )}
              </strong>

              <small>
                Dívida atual de toda a operação
              </small>
            </article>
          </div>

          {/* ===============================================
              CHART + RANKING
          =============================================== */}

          <div className="admin-insights-grid">
            <article className="admin-chart-card admin-reveal">
              <div className="finance-card-heading">
                <div>
                  <span className="section-kicker">
                    EVOLUÇÃO
                  </span>

                  <h2>
                    Resultado da operação
                  </h2>
                </div>

                {loading ? (
                  <RefreshCw
                    size={18}
                    className="spin"
                  />
                ) : null}
              </div>

              <AdminFinancialChart
                days={
                  data.days
                }
              />
            </article>

            <article className="admin-ranking-card admin-reveal">
              <div className="finance-card-heading">
                <div>
                  <span className="section-kicker">
                    RANKING
                  </span>

                  <h2>
                    Faturamento
                  </h2>
                </div>
              </div>

              <div className="admin-ranking-list">
                {data.ranking
                  .slice(
                    0,
                    10,
                  )
                  .map(
                    (
                      employee,
                    ) => (
                      <div
                        key={
                          employee.employeeId
                        }
                        className="admin-ranking-item"
                      >
                        <span className="ranking-position">
                          {String(
                            employee.position,
                          ).padStart(
                            2,
                            '0',
                          )}
                        </span>

                        <div className="ranking-person">
                          <strong>
                            {employee.name}
                          </strong>

                          <span>
                            {employee.active
                              ? 'Ativo'
                              : 'Inativo'}
                          </span>
                        </div>

                        <strong className="ranking-value">
                          {formatBRL(
                            employee
                              .approvedRevenue,
                          )}
                        </strong>
                      </div>
                    ),
                  )}
              </div>
            </article>
          </div>

          {/* ===============================================
              EMPLOYEE VIEW
          =============================================== */}

          <article className="admin-employees-card admin-reveal">
            <div className="admin-employees-heading">
              <div>
                <span className="section-kicker">
                  VISÃO POR FUNCIONÁRIO
                </span>

                <h2>
                  Resultado individual
                </h2>
              </div>

              <label className="admin-employee-search">
                <Search
                  size={17}
                />

                <input
                  type="search"
                  value={
                    search
                  }
                  placeholder="Buscar funcionário..."
                  onChange={(
                    event,
                  ) => {
                    setSearch(
                      event
                        .target
                        .value,
                    );
                  }}
                />
              </label>
            </div>

            {employees.length ===
            0 ? (
              <div className="finance-empty-state">
                Nenhum funcionário encontrado.
              </div>
            ) : (
              <div className="admin-table-scroll">
                <table className="admin-employee-table">
                  <thead>
                    <tr>
                      <th>
                        Funcionário
                      </th>

                      <th>
                        Faturamento
                      </th>

                      <th>
                        Banco
                      </th>

                      <th>
                        ADS
                      </th>

                      <th>
                        Funcionário
                      </th>

                      <th>
                        Lucro ADMIN
                      </th>

                      <th>
                        Dívida atual
                      </th>

                      <th>
                        Situação
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {employees.map(
                      (
                        employee,
                      ) => (
                        <tr
                          key={
                            employee.employeeId
                          }
                        >
                          <td>
                            <div className="admin-employee-cell">
                              <div className="admin-employee-avatar">
                                {employee
                                  .name
                                  .trim()
                                  .charAt(
                                    0,
                                  )
                                  .toUpperCase()}
                              </div>

                              <div>
                                <strong>
                                  {employee.name}
                                </strong>

                                <span>
                                  {employee.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <strong>
                              {formatBRL(
                                employee
                                  .approvedRevenue,
                              )}
                            </strong>
                          </td>

                          <td>
                            {formatBRL(
                              employee
                                .bankCost,
                            )}
                          </td>

                          <td>
                            {formatBRL(
                              employee
                                .adsCost,
                            )}
                          </td>

                          <td>
                            {formatBRL(
                              employee
                                .employeeAmount,
                            )}
                          </td>

                          <td className="admin-profit-value">
                            {formatBRL(
                              employee
                                .adminProfit,
                            )}
                          </td>

                          <td>
                            {formatBRL(
                              employee
                                .currentAdsDebt,
                            )}
                          </td>

                          <td>
                            <div className="admin-table-statuses">
                              <span
                                className={`admin-financial-status ${employee.status.toLowerCase()}`}
                              >
                                {statusLabel(
                                  employee.status,
                                )}
                              </span>

                              {!employee.active ? (
                                <span className="admin-inactive-status">
                                  Inativo
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}