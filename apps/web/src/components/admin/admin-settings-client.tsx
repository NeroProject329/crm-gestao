'use client';

import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import {
  BadgePercent,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  History,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

import {
  gsap,
} from 'gsap';

import type {
  BankFeePolicyView,
} from '@crm/contracts';

import {
  apiRequest,
} from '@/lib/api';

import {
  formatBusinessDate,
} from '@/lib/format';

import {
  FinanceScene,
} from '@/components/three/finance-scene';

type PolicyStatus =
  | 'CURRENT'
  | 'FUTURE'
  | 'ENDED';

type DialogState =
  | {
      mode:
        'CREATE';
    }
  | {
      mode:
        'EDIT';

      policy:
        BankFeePolicyView;
    }
  | null;

interface BankFeeForm {
  percentage:
    string;

  effectiveFrom:
    string;
}

function todayBusinessDate():
  string {
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset();

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

function emptyForm():
  BankFeeForm {
  return {
    percentage:
      '',

    effectiveFrom:
      todayBusinessDate(),
  };
}

function formatPercentageBps(
  percentageBps:
    number,
): string {
  return (
    percentageBps /
    100
  ).toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits:
        percentageBps %
          100 ===
        0
          ? 0
          : 2,

      maximumFractionDigits:
        2,
    },
  ) + '%';
}

function bpsToInput(
  percentageBps:
    number,
): string {
  return (
    percentageBps /
    100
  )
    .toFixed(2)
    .replace(
      '.',
      ',',
    )
    .replace(
      /,00$/,
      '',
    );
}

function percentageToBps(
  value:
    string,
): number | null {
  const normalized =
    value
      .trim()
      .replace(
        '%',
        '',
      )
      .replace(
        ',',
        '.',
      );

  if (
    !/^\d{1,3}(?:\.\d{1,2})?$/
      .test(
        normalized,
      )
  ) {
    return null;
  }

  const percentage =
    Number(
      normalized,
    );

  if (
    !Number.isFinite(
      percentage,
    ) ||
    percentage <
      0 ||
    percentage >
      100
  ) {
    return null;
  }

  return Math.round(
    percentage *
      100,
  );
}

function policyStatus(
  policy:
    BankFeePolicyView,

  today:
    string,
): PolicyStatus {
  if (
    policy.effectiveFrom >
    today
  ) {
    return 'FUTURE';
  }

  if (
    policy.effectiveUntil &&
    policy.effectiveUntil <
      today
  ) {
    return 'ENDED';
  }

  return 'CURRENT';
}

function statusLabel(
  status:
    PolicyStatus,
): string {
  switch (
    status
  ) {
    case 'CURRENT':
      return 'Vigente';

    case 'FUTURE':
      return 'Agendada';

    case 'ENDED':
      return 'Encerrada';
  }
}

function policyRange(
  policy:
    BankFeePolicyView,
): string {
  if (
    policy.effectiveUntil
  ) {
    return `${formatBusinessDate(
      policy.effectiveFrom,
    )} até ${formatBusinessDate(
      policy.effectiveUntil,
    )}`;
  }

  return `${formatBusinessDate(
    policy.effectiveFrom,
  )} em diante`;
}

export function AdminSettingsClient() {
  const [
    policies,
    setPolicies,
  ] =
    useState<
      BankFeePolicyView[]
    >([]);

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
    dialog,
    setDialog,
  ] =
    useState<
      DialogState
    >(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<
      BankFeeForm
    >(
      emptyForm(),
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false,
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

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const today =
    useMemo(
      () =>
        todayBusinessDate(),
      [],
    );

  const loadPolicies =
    useCallback(
      async (
        showLoading =
          true,
      ): Promise<void> => {
        if (
          showLoading
        ) {
          setLoading(
            true,
          );
        } else {
          setRefreshing(
            true,
          );
        }

        setError(
          null,
        );

        try {
          const result =
            await apiRequest<
              BankFeePolicyView[]
            >(
              '/admin/bank-fees',
            );

          setPolicies(
            result,
          );
        } catch (
          cause
        ) {
          setError(
            cause instanceof
              Error
              ? cause.message
              : 'Não foi possível carregar as políticas de taxa bancária.',
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
    void loadPolicies();
  }, [
    loadPolicies,
  ]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setSuccess(
            null,
          );
        },
        5000,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    success,
  ]);

  useEffect(() => {
    if (!dialog) {
      return;
    }

    const previousOverflow =
      document.body
        .style
        .overflow;

    document.body
      .style
      .overflow =
      'hidden';

    function handleKeyDown(
      event:
        KeyboardEvent,
    ): void {
      if (
        event.key ===
          'Escape' &&
        !submitting
      ) {
        setDialog(
          null,
        );

        setError(
          null,
        );
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body
        .style
        .overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    dialog,
    submitting,
  ]);

  useLayoutEffect(() => {
    if (loading) {
      return;
    }

    if (
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
    ) {
      return;
    }

    const context =
      gsap.context(
        () => {
          gsap.fromTo(
            '[data-settings-reveal]',
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

              duration:
                0.65,

              stagger:
                0.06,

              ease:
                'power3.out',
            },
          );
        },
      );

    return () => {
      context.revert();
    };
  }, [
    loading,
    policies.length,
  ]);

  const currentPolicy =
    useMemo(
      () =>
        policies.find(
          (
            policy,
          ) =>
            policyStatus(
              policy,
              today,
            ) ===
            'CURRENT',
        ) ??
        null,
      [
        policies,
        today,
      ],
    );

  const futurePolicies =
    useMemo(
      () =>
        policies
          .filter(
            (
              policy,
            ) =>
              policyStatus(
                policy,
                today,
              ) ===
              'FUTURE',
          )
          .sort(
            (
              first,
              second,
            ) =>
              first.effectiveFrom
                .localeCompare(
                  second.effectiveFrom,
                ),
          ),
      [
        policies,
        today,
      ],
    );

  const nextPolicy =
    futurePolicies[0] ??
    null;

  const endedCount =
    useMemo(
      () =>
        policies.filter(
          (
            policy,
          ) =>
            policyStatus(
              policy,
              today,
            ) ===
            'ENDED',
        ).length,
      [
        policies,
        today,
      ],
    );

  const previewPercentageBps =
    percentageToBps(
      form.percentage,
    );

  function openCreate():
    void {
    setError(
      null,
    );

    setSuccess(
      null,
    );

    setForm(
      emptyForm(),
    );

    setDialog({
      mode:
        'CREATE',
    });
  }

  function openEdit(
    policy:
      BankFeePolicyView,
  ): void {
    setError(
      null,
    );

    setSuccess(
      null,
    );

    setForm({
      percentage:
        bpsToInput(
          policy.percentageBps,
        ),

      effectiveFrom:
        policy.effectiveFrom,
    });

    setDialog({
      mode:
        'EDIT',

      policy,
    });
  }

  function closeDialog():
    void {
    if (
      submitting
    ) {
      return;
    }

    setDialog(
      null,
    );

    setError(
      null,
    );

    setForm(
      emptyForm(),
    );
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!dialog) {
      return;
    }

    const percentageBps =
      percentageToBps(
        form.percentage,
      );

    if (
      percentageBps ===
      null
    ) {
      setError(
        'Informe uma taxa entre 0% e 100%, com no máximo duas casas decimais.',
      );

      return;
    }

    if (
      !form.effectiveFrom
    ) {
      setError(
        'Informe a data inicial da vigência.',
      );

      return;
    }

    setSubmitting(
      true,
    );

    setError(
      null,
    );

    try {
      await apiRequest<
        BankFeePolicyView
      >(
        '/admin/bank-fees/set',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              percentageBps,

              effectiveFrom:
                form.effectiveFrom,
            }),
        },
      );

      setDialog(
        null,
      );

      setForm(
        emptyForm(),
      );

      setSuccess(
        dialog.mode ===
        'EDIT'
          ? 'Política atualizada. O recálculo financeiro foi enviado para o Worker.'
          : 'Nova vigência registrada. O recálculo financeiro foi enviado para o Worker.',
      );

      await loadPolicies(
        false,
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível salvar a política de taxa bancária.',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  if (loading) {
    return (
      <main className="dashboard-loading">
        <LoaderCircle
          size={30}
          className="spin"
        />

        <span>
          Carregando configurações financeiras...
        </span>
      </main>
    );
  }

  return (
    <section className="admin-settings-page">
      {success ? (
        <div className="settings-toast">
          <CheckCircle2
            size={18}
          />

          {success}
        </div>
      ) : null}

      <header
        className="admin-settings-hero"
        data-settings-reveal
      >
        <div className="admin-hero-copy">
          <span className="section-kicker">
            POLÍTICAS FINANCEIRAS
          </span>

          <h1>
            Taxa bancária
            <br />
            sob controle.
          </h1>

          <p>
            Defina a taxa global aplicada à operação,
            preserve todo o histórico de vigências e
            mantenha os resultados financeiros
            recalculados de forma auditável.
          </p>
        </div>

        <div className="settings-hero-card">
          <div className="settings-hero-card-icon">
            <ShieldCheck
              size={24}
            />
          </div>

          <div>
            <span>
              Política vigente
            </span>

            <strong>
              {currentPolicy
                ? formatPercentageBps(
                    currentPolicy
                      .percentageBps,
                  )
                : 'Não definida'}
            </strong>

            <small>
              {currentPolicy
                ? policyRange(
                    currentPolicy,
                  )
                : 'Cadastre a primeira vigência'}
            </small>
          </div>
        </div>

        <div className="admin-hero-three settings-hero-scene">
          <FinanceScene />
        </div>
      </header>

      <div
        className="settings-summary-grid"
        data-settings-reveal
      >
        <article>
          <div className="settings-summary-icon">
            <BadgePercent
              size={22}
            />
          </div>

          <span>
            Taxa atual
          </span>

          <strong>
            {currentPolicy
              ? formatPercentageBps(
                  currentPolicy
                    .percentageBps,
                )
              : '—'}
          </strong>

          <small>
            Aplicada globalmente
          </small>
        </article>

        <article>
          <div className="settings-summary-icon">
            <CalendarClock
              size={22}
            />
          </div>

          <span>
            Próxima alteração
          </span>

          <strong>
            {nextPolicy
              ? formatPercentageBps(
                  nextPolicy
                    .percentageBps,
                )
              : 'Nenhuma'}
          </strong>

          <small>
            {nextPolicy
              ? `A partir de ${formatBusinessDate(
                  nextPolicy
                    .effectiveFrom,
                )}`
              : 'Sem política futura'}
          </small>
        </article>

        <article>
          <div className="settings-summary-icon">
            <Sparkles
              size={22}
            />
          </div>

          <span>
            Vigências agendadas
          </span>

          <strong>
            {futurePolicies.length}
          </strong>

          <small>
            Mudanças futuras
          </small>
        </article>

        <article>
          <div className="settings-summary-icon">
            <History
              size={22}
            />
          </div>

          <span>
            Histórico encerrado
          </span>

          <strong>
            {endedCount}
          </strong>

          <small>
            Segmentos preservados
          </small>
        </article>
      </div>

      <article
        className="settings-control-panel"
        data-settings-reveal
      >
        <div className="settings-control-copy">
          <div className="settings-control-icon">
            <CircleDot
              size={22}
            />
          </div>

          <div>
            <span className="section-kicker">
              NOVA VIGÊNCIA
            </span>

            <h2>
              Atualize a taxa sem apagar o passado
            </h2>

            <p>
              Uma nova data efetiva encerra automaticamente
              a vigência anterior e cria um novo segmento.
              Usar uma data já existente atualiza somente
              aquela política.
            </p>
          </div>
        </div>

        <div className="settings-control-actions">
          <button
            type="button"
            className="settings-refresh-button"
            disabled={
              refreshing
            }
            onClick={() => {
              void loadPolicies(
                false,
              );
            }}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? 'spin'
                  : undefined
              }
            />

            Atualizar
          </button>

          <button
            type="button"
            className="settings-primary-button"
            onClick={
              openCreate
            }
          >
            <Plus
              size={18}
            />

            Nova taxa
          </button>
        </div>
      </article>

      {error && !dialog ? (
        <div className="dashboard-error">
          {error}
        </div>
      ) : null}

      <article
        className="settings-history-panel"
        data-settings-reveal
      >
        <div className="settings-history-heading">
          <div>
            <span className="section-kicker">
              LINHA DO TEMPO
            </span>

            <h2>
              Histórico de taxas bancárias
            </h2>

            <p>
              {policies.length}{' '}
              {policies.length ===
              1
                ? 'vigência registrada'
                : 'vigências registradas'}
            </p>
          </div>

          <div className="settings-history-legend">
            <span className="current">
              Vigente
            </span>

            <span className="future">
              Agendada
            </span>

            <span className="ended">
              Encerrada
            </span>
          </div>
        </div>

        {policies.length ===
        0 ? (
          <div className="settings-empty-state">
            <BadgePercent
              size={38}
            />

            <strong>
              Nenhuma taxa cadastrada
            </strong>

            <span>
              Registre a primeira política para iniciar
              o histórico financeiro.
            </span>

            <button
              type="button"
              onClick={
                openCreate
              }
            >
              <Plus
                size={17}
              />

              Criar primeira vigência
            </button>
          </div>
        ) : (
          <div className="settings-policy-list">
            {policies.map(
              (
                policy,
                index,
              ) => {
                const status =
                  policyStatus(
                    policy,
                    today,
                  );

                return (
                  <article
                    key={
                      policy.id
                    }
                    className={[
                      'settings-policy-card',
                      status
                        .toLowerCase(),
                    ].join(' ')}
                  >
                    <div className="settings-policy-timeline">
                      <span />

                      {index <
                      policies.length -
                        1 ? (
                        <i />
                      ) : null}
                    </div>

                    <div className="settings-policy-main">
                      <div className="settings-policy-value">
                        <span>
                          Taxa aplicada
                        </span>

                        <strong>
                          {formatPercentageBps(
                            policy
                              .percentageBps,
                          )}
                        </strong>
                      </div>

                      <div className="settings-policy-range">
                        <CalendarDays
                          size={18}
                        />

                        <div>
                          <span>
                            Período de vigência
                          </span>

                          <strong>
                            {policyRange(
                              policy,
                            )}
                          </strong>
                        </div>
                      </div>

                      <div className="settings-policy-created">
                        <Clock3
                          size={17}
                        />

                        <div>
                          <span>
                            Registrada em
                          </span>

                          <strong>
                            {new Date(
                              policy
                                .createdAt,
                            ).toLocaleDateString(
                              'pt-BR',
                            )}
                          </strong>
                        </div>
                      </div>

                      <span
                        className={[
                          'settings-policy-status',
                          status
                            .toLowerCase(),
                        ].join(' ')}
                      >
                        {statusLabel(
                          status,
                        )}
                      </span>

                      <button
                        type="button"
                        className="settings-policy-edit"
                        onClick={() => {
                          openEdit(
                            policy,
                          );
                        }}
                      >
                        <PencilLine
                          size={16}
                        />

                        Atualizar
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </article>

      {dialog ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !submitting
            ) {
              closeDialog();
            }
          }}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <header className="settings-modal-header">
              <div>
                <span className="section-kicker">
                  {dialog.mode ===
                  'CREATE'
                    ? 'NOVA POLÍTICA'
                    : 'ATUALIZAR POLÍTICA'}
                </span>

                <h2 id="settings-modal-title">
                  {dialog.mode ===
                  'CREATE'
                    ? 'Definir taxa bancária'
                    : 'Atualizar esta vigência'}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                disabled={
                  submitting
                }
                onClick={
                  closeDialog
                }
              >
                <X
                  size={20}
                />
              </button>
            </header>

            {error ? (
              <div className="settings-modal-error">
                {error}
              </div>
            ) : null}

            <form
              className="settings-form"
              onSubmit={(
                event,
              ) => {
                void submit(
                  event,
                );
              }}
            >
              <div className="settings-form-grid">
                <label>
                  <span>
                    Taxa bancária
                  </span>

                  <div className="settings-percentage-input">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      required
                      placeholder="15,00"
                      value={
                        form.percentage
                      }
                      onChange={(
                        event,
                      ) => {
                        setForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            percentage:
                              event
                                .target
                                .value,
                          }),
                        );
                      }}
                    />

                    <strong>
                      %
                    </strong>
                  </div>
                </label>

                <label>
                  <span>
                    Início da vigência
                  </span>

                  <input
                    type="date"
                    required
                    value={
                      form.effectiveFrom
                    }
                    onChange={(
                      event,
                    ) => {
                      setForm(
                        (
                          current,
                        ) => ({
                            ...current,

                            effectiveFrom:
                              event
                                .target
                                .value,
                          }),
                        );
                      }}
                  />
                </label>
              </div>

              <div className="settings-form-preview">
                <BadgePercent
                  size={22}
                />

                <div>
                  <span>
                    Prévia da política
                  </span>

                  <strong>
                    {previewPercentageBps !==
                    null
                      ? formatPercentageBps(
                          previewPercentageBps,
                        )
                      : 'Informe a taxa'}
                  </strong>

                  <small>
                    {form.effectiveFrom
                      ? `Vigente a partir de ${formatBusinessDate(
                          form.effectiveFrom,
                        )}`
                      : 'Informe a data inicial'}
                  </small>
                </div>
              </div>

              <div className="settings-form-note">
                <ShieldCheck
                  size={18}
                />

                <span>
                  A política será auditada. O backend
                  ajustará automaticamente os intervalos
                  de vigência e enviará o recálculo
                  financeiro para o Worker.
                </span>
              </div>

              <div className="settings-modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={
                    submitting
                  }
                  onClick={
                    closeDialog
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={
                    submitting
                  }
                >
                  {submitting ? (
                    <LoaderCircle
                      size={17}
                      className="spin"
                    />
                  ) : dialog.mode ===
                    'CREATE' ? (
                    <Plus
                      size={17}
                    />
                  ) : (
                    <PencilLine
                      size={17}
                    />
                  )}

                  {dialog.mode ===
                  'CREATE'
                    ? 'Registrar vigência'
                    : 'Salvar alteração'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
