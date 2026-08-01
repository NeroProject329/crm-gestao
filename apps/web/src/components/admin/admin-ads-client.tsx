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
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  CircleOff,
  Edit3,
  FilterX,
  LoaderCircle,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

import {
  gsap,
} from 'gsap';

import type {
  AdsEntryView,
  AdsMutationResponse,
  AdminEmployeeView,
} from '@crm/contracts';

import {
  apiRequest,
} from '@/lib/api';

import {
  formatBRL,
  formatBusinessDate,
} from '@/lib/format';

import {
  FinanceScene,
} from '@/components/three/finance-scene';

type AdsStatusFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'CANCELED';

type AdsDialog =
  | {
      type: 'CREATE';
    }
  | {
      type: 'EDIT';
      entry: AdsEntryView;
    }
  | null;

interface AdsForm {
  employeeId: string;
  businessDate: string;
  amount: string;
}

function localDate(): string {
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

function emptyForm(): AdsForm {
  return {
    employeeId: '',
    businessDate:
      localDate(),
    amount: '',
  };
}

function normalizeAmount(
  value: string,
): string | null {
  const normalized =
    value
      .trim()
      .replace(
        ',',
        '.',
      );

  if (
    !/^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/
      .test(
        normalized,
      )
  ) {
    return null;
  }

  return normalized;
}

function toCents(
  value: string,
): bigint {
  const [
    integer,
    decimal = '',
  ] =
    value.split('.');

  return (
    BigInt(
      integer || '0',
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
        ) || '0',
    )
  );
}

function fromCents(
  value: bigint,
): string {
  return `${
    value / 100n
  }.${
    (
      value % 100n
    )
      .toString()
      .padStart(
        2,
        '0',
      )
  }`;
}

function initials(
  name: string,
): string {
  const parts =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length ===
    0
  ) {
    return '?';
  }

  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2,
      )
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[
      parts.length -
        1
    ][0]
  ).toUpperCase();
}

export function AdminAdsClient() {
  const [
    entries,
    setEntries,
  ] =
    useState<
      AdsEntryView[]
    >([]);

  const [
    employees,
    setEmployees,
  ] =
    useState<
      AdminEmployeeView[]
    >([]);

  const [
    status,
    setStatus,
  ] =
    useState<
      AdsStatusFilter
    >(
      'ALL',
    );

  const [
    employeeId,
    setEmployeeId,
  ] =
    useState('');

  const [
    from,
    setFrom,
  ] =
    useState('');

  const [
    to,
    setTo,
  ] =
    useState('');

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    dialog,
    setDialog,
  ] =
    useState<
      AdsDialog
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<AdsForm>(
      emptyForm(),
    );

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
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    busyId,
    setBusyId,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(null);

  const employeeMap =
    useMemo(
      () =>
        new Map(
          employees.map(
            (
              employee,
            ) => [
              employee.employeeId,
              employee,
            ],
          ),
        ),
      [
        employees,
      ],
    );

  const loadEmployees =
    useCallback(
      async (): Promise<void> => {
        try {
          const result =
            await apiRequest<
              AdminEmployeeView[]
            >(
              '/admin/employees',
            );

          setEmployees(
            result,
          );
        } catch (
          cause
        ) {
          setError(
            cause instanceof
              Error
              ? cause.message
              : 'Não foi possível carregar os funcionários.',
          );
        }
      },
      [],
    );

  const loadEntries =
    useCallback(
      async (
        showLoading = true,
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
          const params =
            new URLSearchParams();

          if (
            status !==
            'ALL'
          ) {
            params.set(
              'status',
              status,
            );
          }

          if (
            employeeId
          ) {
            params.set(
              'employeeId',
              employeeId,
            );
          }

          if (from) {
            params.set(
              'from',
              from,
            );
          }

          if (to) {
            params.set(
              'to',
              to,
            );
          }

          const suffix =
            params.size >
            0
              ? `?${params.toString()}`
              : '';

          const result =
            await apiRequest<
              AdsEntryView[]
            >(
              `/admin/ads${suffix}`,
            );

          setEntries(
            result,
          );
        } catch (
          cause
        ) {
          setError(
            cause instanceof
              Error
              ? cause.message
              : 'Não foi possível carregar os lançamentos de ADS.',
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
        status,
        employeeId,
        from,
        to,
      ],
    );

  useEffect(() => {
    void loadEmployees();
  }, [
    loadEmployees,
  ]);

  useEffect(() => {
    void loadEntries();
  }, [
    loadEntries,
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

    const reduced =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    if (reduced) {
      return;
    }

    const context =
      gsap.context(
        () => {
          gsap.fromTo(
            '[data-ads-reveal]',
            {
              opacity: 0,
              y: 22,
            },
            {
              opacity: 1,
              y: 0,
              duration: 0.65,
              stagger: 0.055,
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
    entries.length,
  ]);

  const statistics =
    useMemo(
      () => {
        const active =
          entries.filter(
            (
              entry,
            ) =>
              entry.status ===
              'ACTIVE',
          );

        const activeAmount =
          active.reduce(
            (
              total,
              entry,
            ) =>
              total +
              toCents(
                entry.amount,
              ),
            0n,
          );

        const canceled =
          entries.filter(
            (
              entry,
            ) =>
              entry.status ===
              'CANCELED',
          ).length;

        const employeesWithAds =
          new Set(
            entries.map(
              (
                entry,
              ) =>
                entry.employeeId,
            ),
          ).size;

        return {
          activeCount:
            active.length,

          activeAmount,

          canceled,

          employeesWithAds,
        };
      },
      [
        entries,
      ],
    );

  const visibleEntries =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLocaleLowerCase(
              'pt-BR',
            );

        if (!query) {
          return entries;
        }

        return entries.filter(
          (
            entry,
          ) => {
            const employee =
              employeeMap.get(
                entry.employeeId,
              );

            return (
              employee
                ?.name
                .toLocaleLowerCase(
                  'pt-BR',
                )
                .includes(
                  query,
                ) ===
                true ||
              employee
                ?.email
                .toLocaleLowerCase(
                  'pt-BR',
                )
                .includes(
                  query,
                ) ===
                true ||
              entry.id
                .toLocaleLowerCase()
                .includes(
                  query,
                )
            );
          },
        );
      },
      [
        entries,
        employeeMap,
        search,
      ],
    );

  function updateForm(
    field:
      keyof AdsForm,

    value:
      string,
  ): void {
    setForm(
      (
        current,
      ) => ({
        ...current,

        [field]:
          value,
      }),
    );
  }

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
      type:
        'CREATE',
    });
  }

  function openEdit(
    entry:
      AdsEntryView,
  ): void {
    if (
      entry.status ===
      'CANCELED'
    ) {
      return;
    }

    setError(
      null,
    );

    setSuccess(
      null,
    );

    setForm({
      employeeId:
        entry.employeeId,

      businessDate:
        entry.businessDate,

      amount:
        entry.amount,
    });

    setDialog({
      type:
        'EDIT',

      entry,
    });
  }

  function closeDialog():
    void {
    if (submitting) {
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

    const amount =
      normalizeAmount(
        form.amount,
      );

    if (
      dialog.type ===
        'CREATE' &&
      !form.employeeId
    ) {
      setError(
        'Selecione o funcionário.',
      );

      return;
    }

    if (
      !form.businessDate
    ) {
      setError(
        'Informe a data do lançamento.',
      );

      return;
    }

    if (!amount) {
      setError(
        'Informe um valor positivo com no máximo duas casas decimais.',
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
      let result:
        AdsMutationResponse;

      if (
        dialog.type ===
        'CREATE'
      ) {
        result =
          await apiRequest<
            AdsMutationResponse
          >(
            '/admin/ads',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  employeeId:
                    form.employeeId,

                  businessDate:
                    form.businessDate,

                  amount,
                }),
            },
          );
      } else {
        result =
          await apiRequest<
            AdsMutationResponse
          >(
            `/admin/ads/${dialog.entry.id}`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify({
                  businessDate:
                    form.businessDate,

                  amount,
                }),
            },
          );
      }

      setDialog(
        null,
      );

      setForm(
        emptyForm(),
      );

      setSuccess(
        result.recalculation
          .status ===
        'PENDING'
          ? 'Lançamento salvo. O recálculo financeiro foi enviado para o Worker.'
          : 'Lançamento salvo e recálculo concluído.',
      );

      await loadEntries(
        false,
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível salvar o lançamento de ADS.',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  async function cancelEntry(
    entry:
      AdsEntryView,
  ): Promise<void> {
    if (
      entry.status ===
      'CANCELED'
    ) {
      return;
    }

    const employee =
      employeeMap.get(
        entry.employeeId,
      );

    const confirmed =
      window.confirm(
        `Cancelar o lançamento de ${formatBRL(
          entry.amount,
        )} para ${
          employee?.name ??
          'este funcionário'
        }?`,
      );

    if (!confirmed) {
      return;
    }

    setBusyId(
      entry.id,
    );

    setError(
      null,
    );

    setSuccess(
      null,
    );

    try {
      const result =
        await apiRequest<
          AdsMutationResponse
        >(
          `/admin/ads/${entry.id}/cancel`,
          {
            method:
              'POST',
          },
        );

      setSuccess(
        result.recalculation
          .status ===
        'PENDING'
          ? 'Lançamento cancelado. O recálculo financeiro foi enviado para o Worker.'
          : 'Lançamento cancelado.',
      );

      await loadEntries(
        false,
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível cancelar o lançamento.',
      );
    } finally {
      setBusyId(
        null,
      );
    }
  }

  function clearFilters():
    void {
    setStatus(
      'ALL',
    );

    setEmployeeId(
      '',
    );

    setFrom(
      '',
    );

    setTo(
      '',
    );

    setSearch(
      '',
    );
  }

  if (loading) {
    return (
      <main className="dashboard-loading">
        <LoaderCircle
          size={30}
          className="spin"
        />

        <span>
          Carregando lançamentos de ADS...
        </span>
      </main>
    );
  }

  return (
    <section className="admin-ads-page">
      {success ? (
        <div className="ads-toast">
          <CheckCircle2
            size={18}
          />

          {success}
        </div>
      ) : null}

      <header
        className="admin-ads-hero"
        data-ads-reveal
      >
        <div className="admin-hero-copy">
          <span className="section-kicker">
            INVESTIMENTO E TRÁFEGO
          </span>

          <h1>
            Gestão de
            <br />
            ADS.
          </h1>

          <p>
            Registre investimentos em anúncios por
            funcionário e data. Edições e cancelamentos
            disparam automaticamente o recálculo
            financeiro da operação.
          </p>
        </div>

        <div className="ads-hero-status">
          <ShieldCheck
            size={23}
          />

          <div>
            <span>
              Recálculo financeiro
            </span>

            <strong>
              Processado pelo Worker
            </strong>
          </div>
        </div>

        <div className="admin-hero-three ads-hero-scene">
          <FinanceScene />
        </div>
      </header>

      <div
        className="ads-summary-grid"
        data-ads-reveal
      >
        <article>
          <div className="ads-summary-icon">
            <BadgeDollarSign
              size={22}
            />
          </div>

          <span>
            ADS ativos
          </span>

          <strong>
            {formatBRL(
              fromCents(
                statistics
                  .activeAmount,
              ),
            )}
          </strong>
        </article>

        <article>
          <div className="ads-summary-icon">
            <Megaphone
              size={22}
            />
          </div>

          <span>
            Lançamentos ativos
          </span>

          <strong>
            {statistics.activeCount}
          </strong>
        </article>

        <article>
          <div className="ads-summary-icon employees">
            <UsersRound
              size={22}
            />
          </div>

          <span>
            Funcionários no período
          </span>

          <strong>
            {statistics.employeesWithAds}
          </strong>
        </article>

        <article>
          <div className="ads-summary-icon canceled">
            <CircleOff
              size={22}
            />
          </div>

          <span>
            Lançamentos cancelados
          </span>

          <strong>
            {statistics.canceled}
          </strong>
        </article>
      </div>

      <article
        className="ads-filter-panel"
        data-ads-reveal
      >
        <div className="ads-filter-top">
          <div className="ads-status-filters">
            {([
              {
                value:
                  'ALL',

                label:
                  'Todos',
              },
              {
                value:
                  'ACTIVE',

                label:
                  'Ativos',
              },
              {
                value:
                  'CANCELED',

                label:
                  'Cancelados',
              },
            ] as const).map(
              (
                option,
              ) => (
                <button
                  key={
                    option.value
                  }
                  type="button"
                  className={
                    status ===
                    option.value
                      ? 'active'
                      : ''
                  }
                  onClick={() => {
                    setStatus(
                      option.value,
                    );
                  }}
                >
                  {option.label}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            className="ads-create-button"
            onClick={
              openCreate
            }
          >
            <Plus
              size={18}
            />

            Novo lançamento
          </button>
        </div>

        <div className="ads-filter-controls">
          <label className="ads-search">
            <Search
              size={17}
            />

            <input
              type="search"
              value={
                search
              }
              placeholder="Buscar funcionário ou identificador"
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

          <label className="ads-select-control">
            <UserRound
              size={17}
            />

            <select
              value={
                employeeId
              }
              onChange={(
                event,
              ) => {
                setEmployeeId(
                  event
                    .target
                    .value,
                );
              }}
            >
              <option value="">
                Todos os funcionários
              </option>

              {employees.map(
                (
                  employee,
                ) => (
                  <option
                    key={
                      employee.employeeId
                    }
                    value={
                      employee.employeeId
                    }
                  >
                    {employee.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="ads-date-control">
            <CalendarDays
              size={17}
            />

            <input
              type="date"
              aria-label="Data inicial"
              value={
                from
              }
              onChange={(
                event,
              ) => {
                setFrom(
                  event
                    .target
                    .value,
                );
              }}
            />
          </label>

          <span className="ads-date-divider">
            até
          </span>

          <label className="ads-date-control">
            <input
              type="date"
              aria-label="Data final"
              value={
                to
              }
              onChange={(
                event,
              ) => {
                setTo(
                  event
                    .target
                    .value,
                );
              }}
            />
          </label>

          <button
            type="button"
            className="ads-icon-button"
            aria-label="Limpar filtros"
            title="Limpar filtros"
            onClick={
              clearFilters
            }
          >
            <FilterX
              size={18}
            />
          </button>

          <button
            type="button"
            className="ads-icon-button"
            aria-label="Atualizar"
            title="Atualizar"
            disabled={
              refreshing
            }
            onClick={() => {
              void loadEntries(
                false,
              );
            }}
          >
            <RefreshCw
              size={18}
              className={
                refreshing
                  ? 'spin'
                  : undefined
              }
            />
          </button>
        </div>
      </article>

      {error && !dialog ? (
        <div className="dashboard-error">
          {error}
        </div>
      ) : null}

      <article
        className="ads-list-panel"
        data-ads-reveal
      >
        <div className="ads-list-heading">
          <div>
            <span className="section-kicker">
              LANÇAMENTOS
            </span>

            <h2>
              Histórico de ADS
            </h2>

            <p>
              {visibleEntries.length}{' '}
              {visibleEntries.length ===
              1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>
        </div>

        {visibleEntries.length ===
        0 ? (
          <div className="ads-empty-state">
            <Megaphone
              size={36}
            />

            <strong>
              Nenhum lançamento encontrado
            </strong>

            <span>
              Ajuste os filtros ou registre um novo
              investimento em ADS.
            </span>
          </div>
        ) : (
          <div className="ads-entry-list">
            {visibleEntries.map(
              (
                entry,
              ) => {
                const employee =
                  employeeMap.get(
                    entry.employeeId,
                  );

                const canceled =
                  entry.status ===
                  'CANCELED';

                const busy =
                  busyId ===
                  entry.id;

                return (
                  <article
                    key={
                      entry.id
                    }
                    className={[
                      'ads-entry-card',

                      canceled
                        ? 'canceled'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="ads-entry-person">
                      <div className="ads-entry-avatar">
                        {initials(
                          employee
                            ?.name ??
                            'Funcionário',
                        )}
                      </div>

                      <div>
                        <strong>
                          {employee
                            ?.name ??
                            'Funcionário'}
                        </strong>

                        <span>
                          {employee
                            ?.email ??
                            entry.employeeId}
                        </span>
                      </div>
                    </div>

                    <div className="ads-entry-detail">
                      <span>
                        Data do ADS
                      </span>

                      <strong>
                        {formatBusinessDate(
                          entry.businessDate,
                        )}
                      </strong>
                    </div>

                    <div className="ads-entry-value">
                      <span>
                        Valor investido
                      </span>

                      <strong>
                        {formatBRL(
                          entry.amount,
                        )}
                      </strong>
                    </div>

                    <div className="ads-entry-detail">
                      <span>
                        Registrado em
                      </span>

                      <strong>
                        {new Date(
                          entry.createdAt,
                        ).toLocaleDateString(
                          'pt-BR',
                        )}
                      </strong>
                    </div>

                    <span
                      className={[
                        'ads-entry-status',

                        canceled
                          ? 'canceled'
                          : 'active',
                      ].join(' ')}
                    >
                      {canceled
                        ? 'Cancelado'
                        : 'Ativo'}
                    </span>

                    <div className="ads-entry-actions">
                      <button
                        type="button"
                        disabled={
                          canceled
                        }
                        onClick={() => {
                          openEdit(
                            entry,
                          );
                        }}
                      >
                        <Edit3
                          size={16}
                        />

                        Editar
                      </button>

                      <button
                        type="button"
                        className="cancel"
                        disabled={
                          canceled ||
                          busy
                        }
                        onClick={() => {
                          void cancelEntry(
                            entry,
                          );
                        }}
                      >
                        {busy ? (
                          <LoaderCircle
                            size={16}
                            className="spin"
                          />
                        ) : (
                          <CircleOff
                            size={16}
                          />
                        )}

                        Cancelar
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
          className="ads-modal-backdrop"
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
            className="ads-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ads-modal-title"
          >
            <header className="ads-modal-header">
              <div>
                <span className="section-kicker">
                  {dialog.type ===
                  'CREATE'
                    ? 'NOVO INVESTIMENTO'
                    : 'ATUALIZAR ADS'}
                </span>

                <h2 id="ads-modal-title">
                  {dialog.type ===
                  'CREATE'
                    ? 'Registrar lançamento'
                    : 'Editar lançamento'}
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
              <div className="ads-modal-error">
                {error}
              </div>
            ) : null}

            <form
              className="ads-form"
              onSubmit={(
                event,
              ) => {
                void submit(
                  event,
                );
              }}
            >
              {dialog.type ===
              'CREATE' ? (
                <label>
                  <span>
                    Funcionário
                  </span>

                  <select
                    value={
                      form.employeeId
                    }
                    required
                    autoFocus
                    onChange={(
                      event,
                    ) => {
                      updateForm(
                        'employeeId',
                        event
                          .target
                          .value,
                      );
                    }}
                  >
                    <option value="">
                      Selecione o funcionário
                    </option>

                    {employees
                      .filter(
                        (
                          employee,
                        ) =>
                          employee.active,
                      )
                      .map(
                        (
                          employee,
                        ) => (
                          <option
                            key={
                              employee.employeeId
                            }
                            value={
                              employee.employeeId
                            }
                          >
                            {employee.name}
                          </option>
                        ),
                      )}
                  </select>
                </label>
              ) : (
                <div className="ads-form-employee">
                  <UserRound
                    size={19}
                  />

                  <div>
                    <span>
                      Funcionário
                    </span>

                    <strong>
                      {employeeMap.get(
                        dialog.entry
                          .employeeId,
                      )?.name ??
                        'Funcionário'}
                    </strong>
                  </div>
                </div>
              )}

              <div className="ads-form-grid">
                <label>
                  <span>
                    Data do investimento
                  </span>

                  <input
                    type="date"
                    value={
                      form.businessDate
                    }
                    required
                    onChange={(
                      event,
                    ) => {
                      updateForm(
                        'businessDate',
                        event
                          .target
                          .value,
                      );
                    }}
                  />
                </label>

                <label>
                  <span>
                    Valor investido
                  </span>

                  <div className="ads-money-input">
                    <strong>
                      R$
                    </strong>

                    <input
                      type="text"
                      inputMode="decimal"
                      value={
                        form.amount
                      }
                      required
                      placeholder="0,00"
                      onChange={(
                        event,
                      ) => {
                        updateForm(
                          'amount',
                          event
                            .target
                            .value,
                        );
                      }}
                    />
                  </div>
                </label>
              </div>

              <div className="ads-form-note">
                <ShieldCheck
                  size={18}
                />

                <span>
                  A alteração será auditada e o Worker
                  recalculará os resultados financeiros
                  desde a data efetiva do lançamento.
                </span>
              </div>

              <div className="ads-modal-actions">
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
                  ) : dialog.type ===
                    'CREATE' ? (
                    <Plus
                      size={17}
                    />
                  ) : (
                    <Edit3
                      size={17}
                    />
                  )}

                  {dialog.type ===
                  'CREATE'
                    ? 'Registrar ADS'
                    : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}