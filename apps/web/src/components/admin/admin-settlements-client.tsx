'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';

import type {
  AdminCurrentWeekView,
  AdminWeeklySettlementView,
  FinancialAdjustmentView,
  WeeklySettlementStatus,
} from '@crm/contracts';

import {
  apiRequest,
} from '@/lib/api';

import {
  formatBRL,
  formatBusinessDate,
} from '@/lib/format';

type StatusFilter =
  | 'ALL'
  | WeeklySettlementStatus;

const filters: Array<{
  value:
    StatusFilter;

  label:
    string;
}> = [
  {
    value:
      'ALL',

    label:
      'Todos',
  },

  {
    value:
      'OPEN',

    label:
      'Abertos',
  },

  {
    value:
      'REVIEW_REQUIRED',

    label:
      'Revisão',
  },

  {
    value:
      'CLOSED',

    label:
      'Fechados',
  },

  {
    value:
      'PAID',

    label:
      'Pagos',
  },
];

function statusLabel(
  status:
    WeeklySettlementStatus,
): string {
  switch (status) {
    case 'OPEN':
      return 'Aberto';

    case 'CLOSED':
      return 'Fechado';

    case 'REVIEW_REQUIRED':
      return 'Revisão necessária';

    case 'PAID':
      return 'Pago';
  }
}

function cents(
  value:
    string,
): bigint {
  const [
    integer,
    decimal = '',
  ] =
    value.split('.');

  const negative =
    integer.startsWith(
      '-',
    );

  const normalizedInteger =
    negative
      ? integer.slice(1)
      : integer;

  const result =
    BigInt(
      normalizedInteger ||
        '0',
    ) *
      100n +
    BigInt(
      decimal
        .padEnd(
          2,
          '0',
        )
        .slice(
          0,
          2,
        ) ||
        '0',
    );

  return negative
    ? -result
    : result;
}

function money(
  value:
    bigint,
): string {
  const negative =
    value < 0n;

  const absolute =
    negative
      ? -value
      : value;

  return `${
    negative
      ? '-'
      : ''
  }${
    absolute /
    100n
  }.${
    (
      absolute %
      100n
    )
      .toString()
      .padStart(
        2,
        '0',
      )
  }`;
}

export function AdminSettlementsClient() {
  const [
    settlements,
    setSettlements,
  ] =
    useState<
      AdminWeeklySettlementView[]
    >(
      [],
    );

  const [
    currentWeek,
    setCurrentWeek,
  ] =
    useState<
      AdminCurrentWeekView |
      null
    >(
      null,
    );

  const [
    filter,
    setFilter,
  ] =
    useState<
      StatusFilter
    >(
      'ALL',
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
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    );

  const [
    busyId,
    setBusyId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    expandedId,
    setExpandedId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    adjustments,
    setAdjustments,
  ] =
    useState<
      Record<
        string,
        FinancialAdjustmentView[]
      >
    >(
      {},
    );

  const [
    adjustmentsLoading,
    setAdjustmentsLoading,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    success,
    setSuccess,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const load =
    useCallback(
      async (
        sync:
          boolean,
      ): Promise<void> => {
        setError(
          null,
        );

        if (sync) {
          setRefreshing(
            true,
          );
        } else {
          setLoading(
            true,
          );
        }

        try {
          let week:
            AdminCurrentWeekView;

          if (sync) {
            week =
              await apiRequest<
                AdminCurrentWeekView
              >(
                '/admin/settlements/current/sync',
                {
                  method:
                    'POST',
                },
              );
          } else {
            /*
             * Na primeira entrada sincronizamos também.
             *
             * OPEN é read model vivo e esta operação
             * é idempotente.
             */
            week =
              await apiRequest<
                AdminCurrentWeekView
              >(
                '/admin/settlements/current/sync',
                {
                  method:
                    'POST',
                },
              );
          }

          const history =
            await apiRequest<
              AdminWeeklySettlementView[]
            >(
              '/admin/settlements',
            );

          setCurrentWeek(
            week,
          );

          setSettlements(
            history,
          );
        } catch (
          cause
        ) {
          setError(
            cause instanceof
              Error
              ? cause.message
              : 'Não foi possível carregar os fechamentos.',
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
      [],
    );

  useEffect(() => {
    void load(
      false,
    );
  }, [
    load,
  ]);

  const visible =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLocaleLowerCase(
              'pt-BR',
            );

        return settlements
          .filter(
            (
              settlement,
            ) =>
              filter ===
                'ALL' ||
              settlement.status ===
                filter,
          )
          .filter(
            (
              settlement,
            ) => {
              if (!query) {
                return true;
              }

              return (
                settlement
                  .employee
                  .name
                  .toLocaleLowerCase(
                    'pt-BR',
                  )
                  .includes(
                    query,
                  ) ||
                settlement
                  .employee
                  .email
                  .toLocaleLowerCase(
                    'pt-BR',
                  )
                  .includes(
                    query,
                  )
              );
            },
          );
      },
      [
        settlements,
        filter,
        search,
      ],
    );

  const totals =
    useMemo(
      () =>
        settlements.reduce(
          (
            accumulator,
            settlement,
          ) => {
            if (
              currentWeek &&
              settlement
                .periodStart ===
                currentWeek
                  .periodStart &&
              settlement
                .periodEnd ===
                currentWeek
                  .periodEnd
            ) {
              accumulator.employee +=
                cents(
                  settlement
                    .employeeAmount,
                );

              accumulator.revenue +=
                cents(
                  settlement
                    .approvedRevenue,
                );

              accumulator.admin +=
                cents(
                  settlement
                    .adminProfit,
                );

              accumulator.debt +=
                cents(
                  settlement
                    .closingAdsDebt,
                );
            }

            return accumulator;
          },
          {
            employee:
              0n,

            revenue:
              0n,

            admin:
              0n,

            debt:
              0n,
          },
        ),
      [
        settlements,
        currentWeek,
      ],
    );

  async function execute(
    settlement:
      AdminWeeklySettlementView,

    action:
      'close'
      | 'review'
      | 'pay',
  ): Promise<void> {
    const message =
      action ===
      'close'
        ? 'Deseja fechar este período? Os valores serão transformados em snapshot aguardando pagamento.'
        : action ===
          'review'
          ? 'Deseja aceitar os valores recalculados e fechar novamente este período?'
          : 'Confirma que o pagamento deste funcionário foi realizado?';

    if (
      !window.confirm(
        message,
      )
    ) {
      return;
    }

    setBusyId(
      settlement.id,
    );

    setError(
      null,
    );

    setSuccess(
      null,
    );

    try {
      await apiRequest<
        AdminWeeklySettlementView
      >(
        `/admin/settlements/${settlement.id}/${action}`,
        {
          method:
            'POST',
        },
      );

      setSuccess(
        action ===
          'close'
          ? 'Fechamento realizado com sucesso.'
          : action ===
            'review'
            ? 'Revisão aceita. O fechamento voltou para o estado fechado.'
            : 'Pagamento marcado como realizado.',
      );

      await load(
        true,
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível concluir a operação.',
      );
    } finally {
      setBusyId(
        null,
      );
    }
  }

  async function toggleAdjustments(
    settlement:
      AdminWeeklySettlementView,
  ): Promise<void> {
    if (
      expandedId ===
      settlement.id
    ) {
      setExpandedId(
        null,
      );

      return;
    }

    setExpandedId(
      settlement.id,
    );

    if (
      adjustments[
        settlement.id
      ]
    ) {
      return;
    }

    setAdjustmentsLoading(
      settlement.id,
    );

    try {
      const result =
        await apiRequest<
          FinancialAdjustmentView[]
        >(
          `/admin/settlements/${settlement.id}/adjustments`,
        );

      setAdjustments(
        (
          previous,
        ) => ({
          ...previous,

          [settlement.id]:
            result,
        }),
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível carregar os ajustes.',
      );
    } finally {
      setAdjustmentsLoading(
        null,
      );
    }
  }

  if (loading) {
    return (
      <main className="dashboard-loading">
        <LoaderCircle
          className="spin"
          size={28}
        />
      </main>
    );
  }

  return (
    <section className="settlements-page">
      <header className="settlements-hero">
        <div>
          <span className="section-kicker">
            FECHAMENTO SEMANAL
          </span>

          <h1>
            Pagamentos da
            operação.
          </h1>

          <p>
            Consolide os resultados financeiros,
            revise alterações históricas e registre
            os pagamentos dos funcionários.
          </p>
        </div>

        <div className="settlement-period-card">
          <CalendarDays
            size={22}
          />

          <div>
            <span>
              Semana atual
            </span>

            <strong>
              {currentWeek
                ? `${formatBusinessDate(
                    currentWeek
                      .periodStart,
                  )} — ${formatBusinessDate(
                    currentWeek
                      .periodEnd,
                  )}`
                : '—'}
            </strong>
          </div>
        </div>
      </header>

      <div className="settlement-summary-grid">
        <article>
          <CircleDollarSign
            size={19}
          />

          <span>
            Faturamento
          </span>

          <strong>
            {formatBRL(
              money(
                totals.revenue,
              ),
            )}
          </strong>
        </article>

        <article>
          <WalletCards
            size={19}
          />

          <span>
            Funcionários
          </span>

          <strong>
            {formatBRL(
              money(
                totals.employee,
              ),
            )}
          </strong>
        </article>

        <article>
          <BadgeDollarSign
            size={19}
          />

          <span>
            Lucro ADMIN
          </span>

          <strong>
            {formatBRL(
              money(
                totals.admin,
              ),
            )}
          </strong>
        </article>

        <article>
          <Banknote
            size={19}
          />

          <span>
            Dívida ADS final
          </span>

          <strong>
            {formatBRL(
              money(
                totals.debt,
              ),
            )}
          </strong>
        </article>
      </div>

      {error ? (
        <div className="dashboard-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="receipt-success">
          <CheckCircle2
            size={18}
          />

          {success}
        </div>
      ) : null}

      <article className="settlements-panel">
        <div className="settlements-toolbar">
          <div className="settlement-filters">
            {filters.map(
              (
                option,
              ) => (
                <button
                  type="button"
                  key={
                    option.value
                  }
                  className={
                    filter ===
                    option.value
                      ? 'settlement-filter active'
                      : 'settlement-filter'
                  }
                  onClick={() => {
                    setFilter(
                      option.value,
                    );
                  }}
                >
                  {
                    option.label
                  }
                </button>
              ),
            )}
          </div>

          <div className="settlements-toolbar-actions">
            <label className="settlement-search">
              <Search
                size={16}
              />

              <input
                type="search"
                placeholder="Buscar funcionário..."
                value={
                  search
                }
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

            <button
              type="button"
              className="settlement-sync-button"
              disabled={
                refreshing
              }
              onClick={() => {
                void load(
                  true,
                );
              }}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? 'spin'
                    : undefined
                }
              />

              Sincronizar
            </button>
          </div>
        </div>

        {visible.length ===
        0 ? (
          <div className="receipt-empty">
            <Clock3
              size={30}
            />

            <strong>
              Nenhum fechamento
            </strong>

            <span>
              Não existem registros para os
              filtros selecionados.
            </span>
          </div>
        ) : (
          <div className="settlements-list">
            {visible.map(
              (
                settlement,
              ) => {
                const busy =
                  busyId ===
                  settlement.id;

                const open =
                  expandedId ===
                  settlement.id;

                const settlementAdjustments =
                  adjustments[
                    settlement.id
                  ] ??
                  [];

                return (
                  <article
                    key={
                      settlement.id
                    }
                    className="settlement-card"
                  >
                    <div className="settlement-card-main">
                      <div className="settlement-person">
                        <div className="settlement-avatar">
                          {settlement
                            .employee
                            .name
                            .trim()
                            .charAt(
                              0,
                            )
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {
                              settlement
                                .employee
                                .name
                            }
                          </strong>

                          <span>
                            {
                              settlement
                                .employee
                                .email
                            }
                          </span>
                        </div>
                      </div>

                      <div className="settlement-period">
                        <span>
                          Período
                        </span>

                        <strong>
                          {formatBusinessDate(
                            settlement
                              .periodStart,
                          )}
                          {' — '}
                          {formatBusinessDate(
                            settlement
                              .periodEnd,
                          )}
                        </strong>
                      </div>

                      <div className="settlement-primary-money">
                        <span>
                          Pagamento
                        </span>

                        <strong>
                          {formatBRL(
                            settlement
                              .employeeAmount,
                          )}
                        </strong>
                      </div>

                      <span
                        className={`settlement-status ${settlement.status.toLowerCase()}`}
                      >
                        {statusLabel(
                          settlement.status,
                        )}
                      </span>
                    </div>

                    <div className="settlement-metrics">
                      <div>
                        <span>
                          Faturamento
                        </span>

                        <strong>
                          {formatBRL(
                            settlement
                              .approvedRevenue,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Banco
                        </span>

                        <strong>
                          {formatBRL(
                            settlement
                              .bankCost,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          ADS
                        </span>

                        <strong>
                          {formatBRL(
                            settlement
                              .adsCost,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Lucro ADMIN
                        </span>

                        <strong>
                          {formatBRL(
                            settlement
                              .adminProfit,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Dívida inicial
                        </span>

                        <strong>
                          {formatBRL(
                            settlement
                              .openingAdsDebt,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Dívida final
                        </span>

                        <strong>
                          {formatBRL(
                            settlement
                              .closingAdsDebt,
                          )}
                        </strong>
                      </div>
                    </div>

                    {settlement.status ===
                    'REVIEW_REQUIRED' ? (
                      <div className="settlement-review-warning">
                        <AlertTriangle
                          size={18}
                        />

                        <div>
                          <strong>
                            Alteração histórica detectada
                          </strong>

                          <span>
                            Os resultados foram recalculados
                            depois do fechamento. Revise antes
                            de pagar.
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <div className="settlement-actions">
                      <button
                        type="button"
                        className="settlement-details-button"
                        onClick={() => {
                          void toggleAdjustments(
                            settlement,
                          );
                        }}
                      >
                        {open ? (
                          <ChevronUp
                            size={16}
                          />
                        ) : (
                          <ChevronDown
                            size={16}
                          />
                        )}

                        Ajustes
                      </button>

                      {settlement.status ===
                      'OPEN' ? (
                        <button
                          type="button"
                          className="settlement-action-primary"
                          disabled={
                            busy
                          }
                          onClick={() => {
                            void execute(
                              settlement,
                              'close',
                            );
                          }}
                        >
                          {busy ? (
                            <LoaderCircle
                              size={16}
                              className="spin"
                            />
                          ) : (
                            <ShieldCheck
                              size={16}
                            />
                          )}

                          Fechar semana
                        </button>
                      ) : null}

                      {settlement.status ===
                      'REVIEW_REQUIRED' ? (
                        <button
                          type="button"
                          className="settlement-action-primary"
                          disabled={
                            busy
                          }
                          onClick={() => {
                            void execute(
                              settlement,
                              'review',
                            );
                          }}
                        >
                          {busy ? (
                            <LoaderCircle
                              size={16}
                              className="spin"
                            />
                          ) : (
                            <CheckCircle2
                              size={16}
                            />
                          )}

                          Aceitar revisão
                        </button>
                      ) : null}

                      {settlement.status ===
                      'CLOSED' ? (
                        <button
                          type="button"
                          className="settlement-action-primary"
                          disabled={
                            busy
                          }
                          onClick={() => {
                            void execute(
                              settlement,
                              'pay',
                            );
                          }}
                        >
                          {busy ? (
                            <LoaderCircle
                              size={16}
                              className="spin"
                            />
                          ) : (
                            <Banknote
                              size={16}
                            />
                          )}

                          Marcar como pago
                        </button>
                      ) : null}
                    </div>

                    {open ? (
                      <div className="settlement-adjustments">
                        <div className="settlement-adjustments-heading">
                          <strong>
                            Ajustes posteriores
                          </strong>

                          <span>
                            Correções após fechamento ou pagamento
                          </span>
                        </div>

                        {adjustmentsLoading ===
                        settlement.id ? (
                          <div className="settlement-adjustment-empty">
                            <LoaderCircle
                              size={17}
                              className="spin"
                            />

                            Carregando...
                          </div>
                        ) : settlementAdjustments.length ===
                          0 ? (
                          <div className="settlement-adjustment-empty">
                            Nenhum ajuste registrado.
                          </div>
                        ) : (
                          settlementAdjustments.map(
                            (
                              adjustment,
                            ) => (
                              <div
                                key={
                                  adjustment.id
                                }
                                className="settlement-adjustment-row"
                              >
                                <span
                                  className={`adjustment-type ${adjustment.type.toLowerCase()}`}
                                >
                                  {adjustment.type ===
                                  'CREDIT'
                                    ? 'Crédito'
                                    : 'Débito'}
                                </span>

                                <strong>
                                  {adjustment.type ===
                                  'CREDIT'
                                    ? '+ '
                                    : '- '}
                                  {formatBRL(
                                    adjustment
                                      .amount,
                                  )}
                                </strong>

                                <span>
                                  {
                                    adjustment.reason
                                  }
                                </span>

                                <small>
                                  {new Date(
                                    adjustment
                                      .createdAt,
                                  ).toLocaleString(
                                    'pt-BR',
                                  )}
                                </small>
                              </div>
                            ),
                          )
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              },
            )}
          </div>
        )}
      </article>
    </section>
  );
}