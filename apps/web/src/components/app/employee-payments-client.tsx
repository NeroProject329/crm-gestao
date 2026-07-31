'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';

import type {
  EmployeeWeeklySettlementView,
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

function statusLabel(
  status:
    WeeklySettlementStatus,
): string {
  switch (status) {
    case 'OPEN':
      return 'Semana em andamento';

    case 'CLOSED':
      return 'Aguardando pagamento';

    case 'REVIEW_REQUIRED':
      return 'Em revisão';

    case 'PAID':
      return 'Pago';
  }
}

export function EmployeePaymentsClient() {
  const [
    current,
    setCurrent,
  ] =
    useState<
      EmployeeWeeklySettlementView |
      null
    >(
      null,
    );

  const [
    settlements,
    setSettlements,
  ] =
    useState<
      EmployeeWeeklySettlementView[]
    >(
      [],
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

  const load =
    useCallback(
      async (): Promise<void> => {
        setLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const [
            currentWeek,
            history,
          ] =
            await Promise.all([
              apiRequest<
                EmployeeWeeklySettlementView
              >(
                '/me/settlements/current',
              ),

              apiRequest<
                EmployeeWeeklySettlementView[]
              >(
                '/me/settlements',
              ),
            ]);

          setCurrent(
            currentWeek,
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
              : 'Não foi possível carregar seus pagamentos.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    void load();
  }, [
    load,
  ]);

const history =
  useMemo(
    () =>
      settlements.filter(
        (
          settlement,
        ) => {
          /*
           * A semana atual ainda em andamento
           * não é histórico.
           */
          if (
            settlement.id ===
              current?.id &&
            settlement.status ===
              'OPEN'
          ) {
            return false;
          }

          /*
           * Assim que a semana foi fechada,
           * entrou em revisão ou foi paga,
           * passa a fazer parte do histórico.
           *
           * Isso permite consultar:
           *
           * - CLOSED
           * - REVIEW_REQUIRED
           * - PAID
           * - ajustes posteriores
           */
          return true;
        },
      ),
    [
      settlements,
      current,
    ],
  );

  async function toggleAdjustments(
    settlement:
      EmployeeWeeklySettlementView,
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
          `/me/settlements/${settlement.id}/adjustments`,
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
          size={28}
          className="spin"
        />
      </main>
    );
  }

  if (
    error &&
    !current
  ) {
    return (
      <div className="dashboard-error">
        {error}
      </div>
    );
  }

  return (
    <section className="employee-payments-page">
      {error ? (
        <div className="dashboard-error">
          {error}
        </div>
      ) : null}

      {current ? (
        <article className="employee-payment-hero">
          <div className="employee-payment-hero-copy">
            <span className="section-kicker">
              SEMANA ATUAL
            </span>

            <h1>
              Seu fechamento.
            </h1>

            <p>
              Acompanhe o valor acumulado da semana,
              o status do fechamento e seu histórico
              de pagamentos.
            </p>

            <div className="employee-payment-period">
              <CalendarDays
                size={16}
              />

              {formatBusinessDate(
                current
                  .periodStart,
              )}
              {' — '}
              {formatBusinessDate(
                current
                  .periodEnd,
              )}
            </div>
          </div>

          <div className="employee-payment-main-value">
            <span>
              Seu valor
            </span>

            <strong>
              {formatBRL(
                current
                  .employeeAmount,
              )}
            </strong>

            <span
              className={`settlement-status ${current.status.toLowerCase()}`}
            >
              {statusLabel(
                current.status,
              )}
            </span>
          </div>
        </article>
      ) : null}

      {current ? (
        <div className="employee-payment-summary">
          <article>
            <ReceiptText
              size={18}
            />

            <span>
              Faturamento aprovado
            </span>

            <strong>
              {formatBRL(
                current
                  .approvedRevenue,
              )}
            </strong>
          </article>

          <article>
            <Banknote
              size={18}
            />

            <span>
              Custo bancário
            </span>

            <strong>
              {formatBRL(
                current
                  .bankCost,
              )}
            </strong>
          </article>

          <article>
            <WalletCards
              size={18}
            />

            <span>
              ADS no período
            </span>

            <strong>
              {formatBRL(
                current
                  .adsCost,
              )}
            </strong>
          </article>

          <article>
            <ShieldCheck
              size={18}
            />

            <span>
              Dívida ADS final
            </span>

            <strong>
              {formatBRL(
                current
                  .closingAdsDebt,
              )}
            </strong>
          </article>
        </div>
      ) : null}

      {current?.status ===
      'REVIEW_REQUIRED' ? (
        <div className="employee-payment-warning">
          <AlertTriangle
            size={19}
          />

          <div>
            <strong>
              Fechamento em revisão
            </strong>

            <span>
              Houve uma alteração em dados financeiros
              do período e o administrador precisa
              revisar o fechamento antes do pagamento.
            </span>
          </div>
        </div>
      ) : null}

      <article className="employee-payment-history-panel">
        <div className="employee-payment-history-heading">
          <div>
            <span className="section-kicker">
              HISTÓRICO
            </span>

            <h2>
              Pagamentos semanais
            </h2>
          </div>

          <span>
            {history.length}{' '}
            {history.length ===
            1
              ? 'período'
              : 'períodos'}
          </span>
        </div>

        {history.length ===
        0 ? (
          <div className="receipt-empty">
            <Clock3
              size={30}
            />

            <strong>
              Nenhum pagamento anterior
            </strong>

            <span>
              Seus fechamentos aparecerão aqui
              conforme as semanas forem concluídas.
            </span>
          </div>
        ) : (
          <div className="employee-payment-history-list">
            {history.map(
              (
                settlement,
              ) => {
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
                    className="employee-payment-history-card"
                  >
                    <div className="employee-payment-history-main">
                      <div>
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

                      <div>
                        <span>
                          Valor
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

                      <button
                        type="button"
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

                        Detalhes
                      </button>
                    </div>

                    {settlement.paidAt ? (
                      <div className="employee-payment-paid-at">
                        <CheckCircle2
                          size={15}
                        />

                        Pago em{' '}
                        {new Date(
                          settlement
                            .paidAt,
                        ).toLocaleString(
                          'pt-BR',
                        )}
                      </div>
                    ) : null}

                    {open ? (
                      <div className="employee-payment-details">
                        <div className="employee-payment-detail-grid">
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

                        <div className="employee-adjustments">
                          <strong>
                            Ajustes posteriores
                          </strong>

                          {adjustmentsLoading ===
                          settlement.id ? (
                            <div className="settlement-adjustment-empty">
                              <LoaderCircle
                                size={16}
                                className="spin"
                              />

                              Carregando...
                            </div>
                          ) : settlementAdjustments.length ===
                            0 ? (
                            <div className="settlement-adjustment-empty">
                              Nenhum crédito ou débito posterior.
                            </div>
                          ) : (
                            settlementAdjustments.map(
                              (
                                adjustment,
                              ) => (
                                <div
                                  className="employee-adjustment-row"
                                  key={
                                    adjustment.id
                                  }
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
                                </div>
                              ),
                            )
                          )}
                        </div>
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