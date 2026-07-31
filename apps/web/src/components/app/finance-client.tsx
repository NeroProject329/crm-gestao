'use client';

import {
  useCallback,
  useLayoutEffect,
  useState,
} from 'react';

import {
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Megaphone,
  RefreshCw,
  TrendingUp,
  WalletCards,
} from 'lucide-react';

import {
  gsap,
} from 'gsap';

import type {
  EmployeeDashboardPreset,
  EmployeeDashboardView,
} from '@crm/contracts';

import {
  apiRequest,
} from '@/lib/api';

import {
  formatBRL,
  formatBusinessDate,
} from '@/lib/format';

import {
  FinancialChart,
} from './financial-chart';

type PeriodPreset =
  EmployeeDashboardPreset;

const PRESETS: Array<{
  value: PeriodPreset;
  label: string;
}> = [
  {
    value: 'TODAY',
    label: 'Hoje',
  },
  {
    value: 'WEEK',
    label: 'Semana',
  },
  {
    value: 'MONTH',
    label: 'Mês',
  },
  {
    value: 'YEAR',
    label: 'Ano',
  },
  {
    value: 'CUSTOM',
    label: 'Período',
  },
];

function today():
  string {
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset();

  return new Date(
    now.getTime() -
      offset * 60_000,
  )
    .toISOString()
    .slice(0, 10);
}

function statusLabel(
  status:
    EmployeeDashboardView['summary']['status'],
): string {
  switch (status) {
    case 'POSITIVE':
      return 'Positivo';

    case 'ADS_DEBT':
      return 'Dívida ADS';

    default:
      return 'Zerado';
  }
}

export function FinanceClient() {
  const [data, setData] =
    useState<EmployeeDashboardView | null>(
      null,
    );

  const [preset, setPreset] =
    useState<PeriodPreset>(
      'MONTH',
    );

  const [customFrom, setCustomFrom] =
    useState(
      today(),
    );

  const [customTo, setCustomTo] =
    useState(
      today(),
    );

  const [loading, setLoading] =
    useState(
      true,
    );

  const [error, setError] =
    useState<string | null>(
      null,
    );

  useLayoutEffect(() => {
    const reducedMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    if (reducedMotion) {
      return;
    }

    const context =
      gsap.context(() => {
        gsap.fromTo(
          '.finance-reveal',
          {
            opacity: 0,
            y: 24,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            stagger: 0.07,
            ease: 'power3.out',
          },
        );
      });

    return () => {
      context.revert();
    };
  }, []);

  const load =
    useCallback(
      async (
        nextPreset:
          PeriodPreset,
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
            await apiRequest<EmployeeDashboardView>(
              `/me/dashboard?${params.toString()}`,
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
              : 'Não foi possível carregar o financeiro.',
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

  async function selectPreset(
    next:
      PeriodPreset,
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

  async function applyCustomPeriod():
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
    !data &&
    loading
  ) {
    return (
      <div className="finance-loading-state">
        <RefreshCw
          size={28}
          className="spin"
        />

        <span>
          Carregando dados financeiros...
        </span>
      </div>
    );
  }

  return (
    <section className="finance-page">
      <div className="finance-header finance-reveal">
        <div>
          <span className="section-kicker">
            HISTÓRICO FINANCEIRO
          </span>

          <h1>
            Sua operação,
            <br />
            dia após dia.
          </h1>

          <p>
            Consulte faturamento aprovado,
            ADS, custo bancário, seu resultado
            e a evolução da dívida.
          </p>
        </div>

        {data ? (
          <div className="finance-period-badge">
            <CalendarDays
              size={18}
            />

            <div>
              <span>
                Período atual
              </span>

              <strong>
                {formatBusinessDate(
                  data.period.from,
                )}
                {' — '}
                {formatBusinessDate(
                  data.period.to,
                )}
              </strong>
            </div>
          </div>
        ) : null}
      </div>

      <div className="finance-filter-panel finance-reveal">
        <div className="finance-preset-list">
          {PRESETS.map(
            (item) => (
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
                  void selectPreset(
                    item.value,
                  );
                }}
              >
                {
                  item.label
                }
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
                void applyCustomPeriod();
              }}
            >
              Aplicar
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="dashboard-error finance-reveal">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="finance-summary-grid">
            <article className="finance-summary-card finance-reveal">
              <div className="finance-summary-icon">
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
                Somente comprovantes aprovados
              </small>
            </article>

            <article className="finance-summary-card finance-reveal">
              <div className="finance-summary-icon">
                <WalletCards
                  size={21}
                />
              </div>

              <span>
                Meu resultado
              </span>

              <strong>
                {formatBRL(
                  data.summary
                    .employeeAmount,
                )}
              </strong>

              <small>
                Resultado já calculado pelo sistema
              </small>
            </article>

            <article className="finance-summary-card finance-reveal">
              <div className="finance-summary-icon">
                <Megaphone
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
                Investimento atribuído no período
              </small>
            </article>

            <article className="finance-summary-card finance-reveal">
              <div className="finance-summary-icon">
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
                Valor financeiro já consolidado
              </small>
            </article>

            <article className="finance-summary-card debt finance-reveal">
              <div className="finance-summary-icon">
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
                    .closingAdsDebt,
                )}
              </strong>

              <small>
                Situação: {' '}
                {statusLabel(
                  data.summary
                    .status,
                )}
              </small>
            </article>
          </div>

          <div className="finance-chart-card finance-reveal">
            <div className="finance-card-heading">
              <div>
                <span className="section-kicker">
                  EVOLUÇÃO
                </span>

                <h2>
                  Movimento financeiro
                </h2>
              </div>

              {loading ? (
                <RefreshCw
                  size={18}
                  className="spin"
                />
              ) : null}
            </div>

            <FinancialChart
              days={
                data.days
              }
            />
          </div>

          <div className="finance-history-card finance-reveal">
            <div className="finance-card-heading">
              <div>
                <span className="section-kicker">
                  DETALHAMENTO
                </span>

                <h2>
                  Histórico diário
                </h2>
              </div>

              <span className="finance-result-count">
                {
                  data.days
                    .length
                }{' '}
                dias
              </span>
            </div>

            {data.days
              .length ===
            0 ? (
              <div className="finance-empty-state">
                Nenhum resultado financeiro
                encontrado neste período.
              </div>
            ) : (
              <div className="finance-table-scroll">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>
                        Data
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
                        Meu resultado
                      </th>

                      <th>
                        Dívida inicial
                      </th>

                      <th>
                        Dívida final
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.days.map(
                      (
                        day,
                      ) => (
                        <tr
                          key={
                            day.businessDate
                          }
                        >
                          <td>
                            <strong>
                              {formatBusinessDate(
                                day.businessDate,
                              )}
                            </strong>
                          </td>

                          <td>
                            {formatBRL(
                              day.approvedRevenue,
                            )}
                          </td>

                          <td>
                            {formatBRL(
                              day.bankCost,
                            )}
                          </td>

                          <td>
                            {formatBRL(
                              day.adsCost,
                            )}
                          </td>

                          <td className="finance-positive-value">
                            {formatBRL(
                              day.employeeAmount,
                            )}
                          </td>

                          <td>
                            {formatBRL(
                              day.openingAdsDebt,
                            )}
                          </td>

                          <td>
                            {formatBRL(
                              day.closingAdsDebt,
                            )}
                          </td>

                          <td>
                            <span
                              className={`finance-status ${day.status.toLowerCase()}`}
                            >
                              {statusLabel(
                                day.status,
                              )}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}