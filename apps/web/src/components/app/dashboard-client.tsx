'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  Landmark,
  Megaphone,
  RefreshCcw,
  Sparkles,
  WalletCards,
} from 'lucide-react';

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
  MoneyCounter,
} from '@/components/motion/money-counter';

import {
  PageTransition,
} from '@/components/motion/page-transition';

import {
  FinanceScene,
} from '@/components/three/finance-scene';

import {
  FinancialChart,
} from './financial-chart';

type Preset =
  EmployeeDashboardPreset;

const presets: Array<{
  value: Preset;
  label: string;
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

function today():
  string {
  const date =
    new Date();

  const year =
    date
      .getFullYear();

  const month =
    String(
      date
        .getMonth() +
        1,
    )
      .padStart(
        2,
        '0',
      );

  const day =
    String(
      date
        .getDate(),
    )
      .padStart(
        2,
        '0',
      );

  return `${year}-${month}-${day}`;
}

function monthStart():
  string {
  const date =
    new Date();

  const year =
    date
      .getFullYear();

  const month =
    String(
      date
        .getMonth() +
        1,
    )
      .padStart(
        2,
        '0',
      );

  return `${year}-${month}-01`;
}

function statusText(
  status:
    EmployeeDashboardView[
      'summary'
    ][
      'status'
    ],
): string {
  if (
    status ===
    'ADS_DEBT'
  ) {
    return 'Saldo comprometido por ADS';
  }

  if (
    status ===
    'POSITIVE'
  ) {
    return 'Operação positiva';
  }

  return 'Sem saldo no período';
}

export function DashboardClient() {
  const [
    preset,
    setPreset,
  ] =
    useState<Preset>(
      'MONTH',
    );

  const [
    customFrom,
    setCustomFrom,
  ] =
    useState(
      monthStart(),
    );

  const [
    customTo,
    setCustomTo,
  ] =
    useState(
      today(),
    );

  const [
    data,
    setData,
  ] =
    useState<
      EmployeeDashboardView |
      null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const load =
    useCallback(
      async (
        nextPreset:
          Preset,

        from?:
          string,

        to?:
          string,
      ): Promise<void> => {
        setError(null);

        if (data) {
          setRefreshing(
            true,
          );
        } else {
          setLoading(
            true,
          );
        }

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
                'Selecione as duas datas.',
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

          const response =
            await apiRequest<
              EmployeeDashboardView
            >(
              `/me/dashboard?${params.toString()}`,
            );

          setData(
            response,
          );
        } catch (
          currentError
        ) {
          setError(
            currentError instanceof
            Error
              ? currentError.message
              : 'Não foi possível carregar o dashboard.',
          );
        } finally {
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );
        }
      },
      [
        data,
      ],
    );

  useEffect(
    () => {
      void load(
        'MONTH',
      );

      // Executamos apenas no mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );

  const history =
    useMemo(
      () =>
        data
          ? [
              ...data.days,
            ].reverse()
          : [],
      [
        data,
      ],
    );

  function choosePreset(
    nextPreset:
      Preset,
  ): void {
    setPreset(
      nextPreset,
    );

    if (
      nextPreset ===
      'CUSTOM'
    ) {
      return;
    }

    void load(
      nextPreset,
    );
  }

  function applyCustom():
    void {
    setPreset(
      'CUSTOM',
    );

    void load(
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
      <div className="dashboard-loading">
        <div className="loading-ring" />
      </div>
    );
  }

  if (
    error &&
    !data
  ) {
    return (
      <section className="dashboard-error">
        <div className="dashboard-error-icon">
          <AlertTriangle
            size={24}
          />
        </div>

        <h2>
          Não conseguimos carregar
          seu dashboard.
        </h2>

        <p>
          {error}
        </p>

        <button
          type="button"

          className="primary-inline-button"

          onClick={
            () => {
              void load(
                preset,
                customFrom,
                customTo,
              );
            }
          }
        >
          <RefreshCcw
            size={17}
          />

          Tentar novamente
        </button>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <PageTransition>
      <div className="dashboard-page">
        <section
          className="dashboard-toolbar"

          data-motion="page-header"
        >
          <div className="period-pills">
            {
              presets.map(
                (
                  option,
                ) => (
                  <button
                    key={
                      option.value
                    }

                    type="button"

                    className={
                      [
                        'period-pill',

                        preset ===
                        option.value
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

                    onClick={
                      () =>
                        choosePreset(
                          option.value,
                        )
                    }
                  >
                    {
                      option.label
                    }
                  </button>
                ),
              )
            }
          </div>

          <div className="dashboard-range-label">
            <CalendarDays
              size={16}
            />

            {
              `${formatBusinessDate(
                data
                  .period
                  .from,
              )} — ${formatBusinessDate(
                data
                  .period
                  .to,
              )}`
            }
          </div>
        </section>

        {
          preset ===
          'CUSTOM'
            ? (
              <section
                className="custom-period"
                data-motion="page-header"
              >
                <label>
                  <span>
                    De
                  </span>

                  <input
                    type="date"

                    value={
                      customFrom
                    }

                    onChange={
                      (
                        event,
                      ) =>
                        setCustomFrom(
                          event
                            .target
                            .value,
                        )
                    }
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

                    onChange={
                      (
                        event,
                      ) =>
                        setCustomTo(
                          event
                            .target
                            .value,
                        )
                    }
                  />
                </label>

                <button
                  type="button"

                  className="primary-inline-button"

                  onClick={
                    applyCustom
                  }
                >
                  Aplicar

                  <ArrowRight
                    size={16}
                  />
                </button>
              </section>
            )
            : null
        }

        {
          error
            ? (
              <div className="inline-warning">
                <AlertTriangle
                  size={16}
                />

                {
                  error
                }
              </div>
            )
            : null
        }

        <section
          className="hero-card"

          data-motion="hero"
        >
          <div className="hero-content">
            <span className="hero-eyebrow">
              <Sparkles
                size={15}
              />

              Seu resultado
            </span>

            <h2 className="hero-value">
              <MoneyCounter
                value={
                  data
                    .summary
                    .employeeAmount
                }
              />
            </h2>

            <p className="hero-subtitle">
              Resultado acumulado
              no período selecionado.
            </p>

            <div className="hero-meta">
              <span>
                {
                  data
                    .employee
                    .name
                }
              </span>

              <span>
                {
                  data.days
                    .length
                } dias
                processados
              </span>
            </div>
          </div>

          <div className="hero-three">
            <FinanceScene />
          </div>
        </section>

        <section className="metrics-grid">
          <article
            className="metric-card"
            data-motion="card"
          >
            <div className="metric-icon">
              <WalletCards
                size={20}
              />
            </div>

            <p className="metric-label">
              Faturamento aprovado
            </p>

            <p className="metric-value">
              <MoneyCounter
                value={
                  data
                    .summary
                    .approvedRevenue
                }
              />
            </p>

            <span className="metric-caption">
              Receita aprovada
              no período
            </span>
          </article>

          <article
            className="metric-card"
            data-motion="card"
          >
            <div className="metric-icon">
              <Megaphone
                size={20}
              />
            </div>

            <p className="metric-label">
              Investimento ADS
            </p>

            <p className="metric-value">
              <MoneyCounter
                value={
                  data
                    .summary
                    .adsCost
                }
              />
            </p>

            <span className="metric-caption">
              Custo de mídia
              acumulado
            </span>
          </article>

          <article
            className="metric-card"
            data-motion="card"
          >
            <div className="metric-icon">
              <Landmark
                size={20}
              />
            </div>

            <p className="metric-label">
              Custo bancário
            </p>

            <p className="metric-value">
              <MoneyCounter
                value={
                  data
                    .summary
                    .bankCost
                }
              />
            </p>

            <span className="metric-caption">
              Tarifas aplicadas
              ao faturamento
            </span>
          </article>
        </section>

        <section className="dashboard-lower">
          <article
            className="panel-card"
            data-motion="card"
          >
            <div className="panel-header">
              <div>
                <p className="panel-kicker">
                  Performance
                </p>

                <h3 className="panel-title">
                  Evolução financeira
                </h3>
              </div>

              {
                refreshing
                  ? (
                    <RefreshCcw
                      size={18}

                      className="spin-soft"
                    />
                  )
                  : null
              }
            </div>

            <FinancialChart
              days={
                data.days
              }
            />
          </article>

          <article
            className="panel-card debt-card"
            data-motion="card"
          >
            <Banknote
              size={28}
            />

            <p className="debt-label">
              Dívida ADS atual
            </p>

            <p className="debt-value">
              <MoneyCounter
                value={
                  data
                    .summary
                    .closingAdsDebt
                }
              />
            </p>

            <div className="status-badge">
              {
                statusText(
                  data
                    .summary
                    .status,
                )
              }
            </div>

            <div className="debt-details">
              <div>
                <span>
                  Saldo inicial
                </span>

                <strong>
                  {
                    formatBRL(
                      data
                        .summary
                        .openingAdsDebt,
                    )
                  }
                </strong>
              </div>

              <div>
                <span>
                  Saldo final
                </span>

                <strong>
                  {
                    formatBRL(
                      data
                        .summary
                        .closingAdsDebt,
                    )
                  }
                </strong>
              </div>
            </div>
          </article>
        </section>

        <section
          className="panel-card history-panel"

          data-motion="card"
        >
          <div className="panel-header">
            <div>
              <p className="panel-kicker">
                Histórico
              </p>

              <h3 className="panel-title">
                Resultado diário
              </h3>
            </div>

            <span className="history-count">
              {
                history.length
              } registros
            </span>
          </div>

          {
            history.length ===
            0
              ? (
                <div className="history-empty">
                  Nenhum resultado
                  financeiro encontrado
                  para este período.
                </div>
              )
              : (
                <div className="history-table-wrap">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>
                          Data
                        </th>

                        <th>
                          Faturamento
                        </th>

                        <th>
                          ADS
                        </th>

                        <th>
                          Banco
                        </th>

                        <th>
                          Seu resultado
                        </th>

                        <th>
                          Situação
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {
                        history.map(
                          (
                            day,
                          ) => (
                            <tr
                              key={
                                day
                                  .businessDate
                              }
                            >
                              <td>
                                {
                                  formatBusinessDate(
                                    day
                                      .businessDate,
                                  )
                                }
                              </td>

                              <td>
                                {
                                  formatBRL(
                                    day
                                      .approvedRevenue,
                                  )
                                }
                              </td>

                              <td>
                                {
                                  formatBRL(
                                    day
                                      .adsCost,
                                  )
                                }
                              </td>

                              <td>
                                {
                                  formatBRL(
                                    day
                                      .bankCost,
                                  )
                                }
                              </td>

                              <td className="history-result">
                                {
                                  formatBRL(
                                    day
                                      .employeeAmount,
                                  )
                                }
                              </td>

                              <td>
                                <span
                                  className={
                                    `table-status ${
                                      day.status
                                        .toLowerCase()
                                    }`
                                  }
                                >
                                  {
                                    day.status ===
                                    'POSITIVE'
                                      ? 'Positivo'
                                      : day.status ===
                                        'ADS_DEBT'
                                        ? 'Dívida ADS'
                                        : 'Zerado'
                                  }
                                </span>
                              </td>
                            </tr>
                          ),
                        )
                      }
                    </tbody>
                  </table>
                </div>
              )
          }
        </section>
      </div>
    </PageTransition>
  );
}