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
  CalendarDays,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileClock,
  FileText,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ThumbsUp,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';

import {
  gsap,
} from 'gsap';

import type {
  AdminEmployeeView,
  AdminReceiptActionResponse,
  AdminReceiptView,
  ReceiptFileUrlResponse,
  ReceiptStatus,
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

type ReceiptFilter =
  | 'ALL'
  | ReceiptStatus;

type AdminReceiptAction =
  | 'APPROVE'
  | 'REJECT'
  | 'REVERSE';

interface ReceiptPreview {
  receipt:
    AdminReceiptView;

  url:
    string;
}

const FILTERS: Array<{
  value:
    ReceiptFilter;

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
      'PENDING',

    label:
      'Pendentes',
  },

  {
    value:
      'APPROVED',

    label:
      'Aprovados',
  },

  {
    value:
      'REJECTED',

    label:
      'Rejeitados',
  },

  {
    value:
      'CANCELED',

    label:
      'Cancelados',
  },

  {
    value:
      'REVERSED',

    label:
      'Revertidos',
  },
];

function statusLabel(
  status:
    ReceiptStatus,
): string {
  switch (
    status
  ) {
    case 'PENDING':
      return 'Pendente';

    case 'APPROVED':
      return 'Aprovado';

    case 'REJECTED':
      return 'Rejeitado';

    case 'CANCELED':
      return 'Cancelado';

    case 'REVERSED':
      return 'Revertido';
  }
}

function actionTitle(
  action:
    AdminReceiptAction,
): string {
  switch (
    action
  ) {
    case 'APPROVE':
      return 'Aprovar comprovante';

    case 'REJECT':
      return 'Rejeitar comprovante';

    case 'REVERSE':
      return 'Reverter aprovação';
  }
}

function actionDescription(
  action:
    AdminReceiptAction,
): string {
  switch (
    action
  ) {
    case 'APPROVE':
      return 'Após a aprovação, o comprovante poderá passar a compor o resultado financeiro oficial.';

    case 'REJECT':
      return 'Informe o motivo da rejeição. O comprovante não entrará no faturamento aprovado.';

    case 'REVERSE':
      return 'Informe o motivo da reversão. O efeito financeiro deste comprovante será recalculado.';
  }
}

export function AdminReceiptsClient() {
  const [
    receipts,
    setReceipts,
  ] =
    useState<
      AdminReceiptView[]
    >(
      [],
    );

  const [
    employees,
    setEmployees,
  ] =
    useState<
      AdminEmployeeView[]
    >(
      [],
    );

  const [
    status,
    setStatus,
  ] =
    useState<
      ReceiptFilter
    >(
      'PENDING',
    );

  const [
    employeeId,
    setEmployeeId,
  ] =
    useState(
      '',
    );

  const [
    from,
    setFrom,
  ] =
    useState(
      '',
    );

  const [
    to,
    setTo,
  ] =
    useState(
      '',
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
    busyReceiptId,
    setBusyReceiptId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    preview,
    setPreview,
  ] =
    useState<
      ReceiptPreview |
      null
    >(
      null,
    );

  const [
    action,
    setAction,
  ] =
    useState<
      AdminReceiptAction |
      null
    >(
      null,
    );

  const [
    actionText,
    setActionText,
  ] =
    useState(
      '',
    );

  const [
    actionLoading,
    setActionLoading,
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

  /* =======================================================
     EMPLOYEE MAP
  ======================================================= */

  const employeeMap =
    useMemo(
      () =>
        new Map(
          employees.map(
            (
              employee,
            ) => [
              employee
                .employeeId,

              employee,
            ],
          ),
        ),
      [
        employees,
      ],
    );

  function employeeName(
    currentEmployeeId:
      string,
  ): string {
    return (
      employeeMap.get(
        currentEmployeeId,
      )?.name ??
      'Funcionário'
    );
  }

  /* =======================================================
     ANIMATION
  ======================================================= */

  useLayoutEffect(() => {
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
            '.admin-receipt-reveal',
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
                0.06,

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

  /* =======================================================
     MODAL
  ======================================================= */

  useEffect(() => {
    if (!preview) {
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
        'Escape'
      ) {
        if (action) {
          setAction(
            null,
          );

          setActionText(
            '',
          );

          return;
        }

        setPreview(
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
    preview,
    action,
  ]);

  /* =======================================================
     EMPLOYEES
  ======================================================= */

  const loadEmployees =
    useCallback(
      async () => {
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

  useEffect(() => {
    void loadEmployees();
  }, [
    loadEmployees,
  ]);

  /* =======================================================
     RECEIPTS
  ======================================================= */

  const loadReceipts =
    useCallback(
      async () => {
        setLoading(
          true,
        );

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
              AdminReceiptView[]
            >(
              `/admin/receipts${suffix}`,
            );

          setReceipts(
            result,
          );
        } catch (
          cause
        ) {
          setError(
            cause instanceof
              Error
              ? cause.message
              : 'Não foi possível carregar os comprovantes.',
          );
        } finally {
          setLoading(
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
    void loadReceipts();
  }, [
    loadReceipts,
  ]);

  /* =======================================================
     LOCAL SEARCH
  ======================================================= */

  const visibleReceipts =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLocaleLowerCase(
              'pt-BR',
            );

        if (!query) {
          return receipts;
        }

        return receipts
          .filter(
            (
              receipt,
            ) => {
              const employee =
                employeeMap.get(
                  receipt
                    .employeeId,
                );

              return (
                receipt
                  .payerName
                  .toLocaleLowerCase(
                    'pt-BR',
                  )
                  .includes(
                    query,
                  ) ||
                employee
                  ?.name
                  .toLocaleLowerCase(
                    'pt-BR',
                  )
                  .includes(
                    query,
                  ) ||
                employee
                  ?.email
                  .toLocaleLowerCase(
                    'pt-BR',
                  )
                  .includes(
                    query,
                  ) ===
                  true
              );
            },
          );
      },
      [
        receipts,
        employeeMap,
        search,
      ],
    );

  /* =======================================================
     OPEN FILE
  ======================================================= */

  async function openReceipt(
    receipt:
      AdminReceiptView,
  ): Promise<void> {
    setError(
      null,
    );

    setSuccess(
      null,
    );

    setBusyReceiptId(
      receipt.id,
    );

    try {
      const result =
        await apiRequest<
          ReceiptFileUrlResponse
        >(
          `/admin/receipts/${receipt.id}/file-url`,
        );

      setAction(
        null,
      );

      setActionText(
        '',
      );

      setPreview({
        receipt,

        url:
          result.url,
      });
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível abrir o comprovante.',
      );
    } finally {
      setBusyReceiptId(
        null,
      );
    }
  }

  /* =======================================================
     ACTION PANEL
  ======================================================= */

  function startAction(
    nextAction:
      AdminReceiptAction,
  ): void {
    setActionText(
      '',
    );

    setAction(
      nextAction,
    );
  }

  function cancelAction():
    void {
    setAction(
      null,
    );

    setActionText(
      '',
    );
  }

  /* =======================================================
     APPROVE / REJECT / REVERSE
  ======================================================= */

  async function executeAction(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      !preview ||
      !action
    ) {
      return;
    }

    const text =
      actionText.trim();

    if (
      (
        action ===
          'REJECT' ||
        action ===
          'REVERSE'
      ) &&
      text.length <
        2
    ) {
      setError(
        'Informe um motivo com pelo menos 2 caracteres.',
      );

      return;
    }

    setActionLoading(
      true,
    );

    setError(
      null,
    );

    setSuccess(
      null,
    );

    const receiptId =
      preview
        .receipt
        .id;

    try {
      let endpoint:
        string;

      let body:
        Record<
          string,
          string
        >;

      switch (
        action
      ) {
        case 'APPROVE':
          endpoint =
            'approve';

          body =
            text
              ? {
                  note:
                    text,
                }
              : {};

          break;

        case 'REJECT':
          endpoint =
            'reject';

          body = {
            reason:
              text,
          };

          break;

        case 'REVERSE':
          endpoint =
            'reverse';

          body = {
            reason:
              text,
          };

          break;
      }

      const result =
        await apiRequest<
          AdminReceiptActionResponse
        >(
          `/admin/receipts/${receiptId}/${endpoint}`,
          {
            method:
              'POST',

            body:
              JSON.stringify(
                body,
              ),
          },
        );

      let message:
        string;

      switch (
        action
      ) {
        case 'APPROVE':
          message =
            'Comprovante aprovado com sucesso.';

          break;

        case 'REJECT':
          message =
            'Comprovante rejeitado.';

          break;

        case 'REVERSE':
          message =
            'Aprovação revertida com sucesso.';

          break;
      }

      if (
        result.recalculation
          ?.status ===
        'PENDING'
      ) {
        message +=
          ' O recálculo financeiro foi enviado para processamento.';
      }

      setSuccess(
        message,
      );

      setPreview(
        null,
      );

      setAction(
        null,
      );

      setActionText(
        '',
      );

      await loadReceipts();
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível realizar a ação.',
      );
    } finally {
      setActionLoading(
        false,
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section className="admin-receipts-page">
      {/* ==================================================
          HERO
      ================================================== */}

      <header className="admin-receipts-hero admin-receipt-reveal">
        <div className="admin-hero-copy">
          <span className="section-kicker">
            RECEBIMENTOS
          </span>

          <h1>
            Central de
            <br />
            comprovantes.
          </h1>

          <p>
            Analise os pagamentos enviados pelos
            funcionários, visualize os arquivos e
            controle a entrada no faturamento oficial.
          </p>
        </div>

        <div className="admin-receipts-security">
          <ShieldCheck
            size={23}
          />

          <div>
            <strong>
              Análise administrativa
            </strong>

            <span>
              Aprovação, rejeição e reversão auditáveis
            </span>
          </div>
        </div>

        <div className="admin-hero-three admin-receipts-scene">
          <FinanceScene />
        </div>
      </header>

      {/* ==================================================
          FILTERS
      ================================================== */}

      <article className="admin-receipts-filter-card admin-receipt-reveal">
        <div className="admin-receipt-status-list">
          {FILTERS.map(
            (
              filter,
            ) => (
              <button
                key={
                  filter.value
                }
                type="button"
                className={
                  status ===
                  filter.value
                    ? 'admin-receipt-filter active'
                    : 'admin-receipt-filter'
                }
                onClick={() => {
                  setStatus(
                    filter.value,
                  );
                }}
              >
                {
                  filter.label
                }
              </button>
            ),
          )}
        </div>

        <div className="admin-receipts-filter-controls">
          <label className="admin-receipt-employee-select">
            <UserRound
              size={16}
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

          <label className="admin-receipt-date-input">
            <CalendarDays
              size={16}
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

          <span className="admin-receipt-date-divider">
            até
          </span>

          <label className="admin-receipt-date-input">
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

          {from ||
          to ? (
            <button
              type="button"
              className="admin-receipt-clear"
              aria-label="Limpar datas"
              onClick={() => {
                setFrom(
                  '',
                );

                setTo(
                  '',
                );
              }}
            >
              <X
                size={16}
              />
            </button>
          ) : null}
        </div>
      </article>

      {/* ==================================================
          FEEDBACK
      ================================================== */}

      {error ? (
        <div className="dashboard-error admin-receipt-reveal">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="receipt-success admin-receipt-reveal">
          <CheckCircle2
            size={19}
          />

          {success}
        </div>
      ) : null}

      {/* ==================================================
          LIST
      ================================================== */}

      <article className="admin-receipts-list-card admin-receipt-reveal">
        <div className="admin-receipts-list-heading">
          <div>
            <span className="section-kicker">
              ANÁLISE
            </span>

            <h2>
              Comprovantes
            </h2>

            <span className="admin-receipts-count">
              {visibleReceipts.length}{' '}
              {visibleReceipts.length ===
              1
                ? 'registro'
                : 'registros'}
            </span>
          </div>

          <div className="admin-receipts-heading-actions">
            <label className="admin-receipts-search">
              <Search
                size={16}
              />

              <input
                type="search"
                placeholder="Buscar pagador ou funcionário..."
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
              className="receipt-refresh-button"
              disabled={
                loading
              }
              onClick={() => {
                void loadReceipts();
              }}
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? 'spin'
                    : undefined
                }
              />

              Atualizar
            </button>
          </div>
        </div>

        {loading &&
        receipts.length ===
          0 ? (
          <div className="finance-empty-state">
            <LoaderCircle
              size={24}
              className="spin"
            />

            Carregando comprovantes...
          </div>
        ) : visibleReceipts.length ===
          0 ? (
          <div className="receipt-empty">
            <FileClock
              size={32}
            />

            <strong>
              Nenhum comprovante
            </strong>

            <span>
              Não existem registros para os filtros
              selecionados.
            </span>
          </div>
        ) : (
          <div className="admin-receipts-table-scroll">
            <table className="admin-receipts-table">
              <thead>
                <tr>
                  <th>
                    Funcionário
                  </th>

                  <th>
                    Pagador
                  </th>

                  <th>
                    Valor
                  </th>

                  <th>
                    Pagamento
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Arquivo
                  </th>

                  <th>
                    Ação
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleReceipts.map(
                  (
                    receipt,
                  ) => {
                    const employee =
                      employeeMap.get(
                        receipt
                          .employeeId,
                      );

                    const busy =
                      busyReceiptId ===
                      receipt.id;

                    return (
                      <tr
                        key={
                          receipt.id
                        }
                      >
                        <td>
                          <div className="admin-receipt-employee-cell">
                            <div className="admin-receipt-avatar">
                              {(employee
                                ?.name ??
                                'F')
                                .trim()
                                .charAt(
                                  0,
                                )
                                .toUpperCase()}
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
                                  receipt.employeeId}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {
                              receipt
                                .payerName
                            }
                          </strong>
                        </td>

                        <td>
                          <strong>
                            {formatBRL(
                              receipt
                                .amount,
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong>
                            {formatBusinessDate(
                              receipt
                                .businessDate,
                            )}
                          </strong>

                          <small>
                            {new Date(
                              receipt
                                .paidAt,
                            ).toLocaleTimeString(
                              'pt-BR',
                              {
                                hour:
                                  '2-digit',

                                minute:
                                  '2-digit',
                              },
                            )}
                          </small>
                        </td>

                        <td>
                          <span
                            className={`receipt-status ${receipt.status.toLowerCase()}`}
                          >
                            {statusLabel(
                              receipt.status,
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="receipt-file-meta">
                            <FileText
                              size={16}
                            />

                            {receipt
                              .file
                              .mimeType ===
                            'application/pdf'
                              ? 'PDF'
                              : 'Imagem'}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="admin-analyze-receipt-button"
                            disabled={
                              busy
                            }
                            onClick={() => {
                              void openReceipt(
                                receipt,
                              );
                            }}
                          >
                            {busy ? (
                              <LoaderCircle
                                size={16}
                                className="spin"
                              />
                            ) : (
                              <Eye
                                size={16}
                              />
                            )}

                            {receipt.status ===
                            'PENDING'
                              ? 'Analisar'
                              : 'Visualizar'}
                          </button>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* ==================================================
          VIEWER
      ================================================== */}

      {preview ? (
        <div
          className="receipt-preview-overlay"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget &&
              !action
            ) {
              setPreview(
                null,
              );
            }
          }}
        >
          <div
            className="receipt-preview-modal admin-receipt-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Análise do comprovante"
          >
            {/* =============================================
                FILE
            ============================================= */}

            <div className="receipt-preview-main">
              <div className="receipt-preview-topbar">
                <div>
                  <FileCheck2
                    size={18}
                  />

                  <span>
                    Análise do comprovante
                  </span>
                </div>

                <button
                  type="button"
                  className="receipt-preview-close"
                  aria-label="Fechar"
                  onClick={() => {
                    setPreview(
                      null,
                    );

                    setAction(
                      null,
                    );
                  }}
                >
                  <X
                    size={18}
                  />

                  <span>
                    Fechar
                  </span>
                </button>
              </div>

              <div className="receipt-preview-media">
                {preview
                  .receipt
                  .file
                  .mimeType ===
                'application/pdf' ? (
                  <iframe
                    src={
                      preview.url
                    }
                    title="Comprovante em PDF"
                    className="receipt-preview-pdf"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      preview.url
                    }
                    alt={`Comprovante de ${preview.receipt.payerName}`}
                    className="receipt-preview-image"
                  />
                )}
              </div>
            </div>

            {/* =============================================
                DETAILS
            ============================================= */}

            <aside className="receipt-preview-info admin-receipt-preview-info">
              <div className="receipt-preview-info-header">
                <span className="section-kicker">
                  COMPROVANTE
                </span>

                <h2>
                  {
                    preview
                      .receipt
                      .payerName
                  }
                </h2>

                <span
                  className={`receipt-status ${preview.receipt.status.toLowerCase()}`}
                >
                  {statusLabel(
                    preview
                      .receipt
                      .status,
                  )}
                </span>
              </div>

              <div className="receipt-preview-value">
                <span>
                  Valor recebido
                </span>

                <strong>
                  {formatBRL(
                    preview
                      .receipt
                      .amount,
                  )}
                </strong>
              </div>

              <div className="receipt-preview-details">
                <div>
                  <span>
                    Funcionário
                  </span>

                  <strong>
                    {employeeName(
                      preview
                        .receipt
                        .employeeId,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Pagador
                  </span>

                  <strong>
                    {
                      preview
                        .receipt
                        .payerName
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Data do pagamento
                  </span>

                  <strong>
                    {formatBusinessDate(
                      preview
                        .receipt
                        .businessDate,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Horário
                  </span>

                  <strong>
                    {new Date(
                      preview
                        .receipt
                        .paidAt,
                    ).toLocaleTimeString(
                      'pt-BR',
                      {
                        hour:
                          '2-digit',

                        minute:
                          '2-digit',
                      },
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Tipo de arquivo
                  </span>

                  <strong>
                    {preview
                      .receipt
                      .file
                      .mimeType ===
                    'application/pdf'
                      ? 'PDF'
                      : 'Imagem'}
                  </strong>
                </div>

                {preview
                  .receipt
                  .reviewedAt ? (
                  <div>
                    <span>
                      Analisado em
                    </span>

                    <strong>
                      {new Date(
                        preview
                          .receipt
                          .reviewedAt,
                      ).toLocaleString(
                        'pt-BR',
                      )}
                    </strong>
                  </div>
                ) : null}

                {preview
                  .receipt
                  .reviewNote ? (
                  <div className="admin-receipt-long-detail">
                    <span>
                      Observação
                    </span>

                    <strong>
                      {
                        preview
                          .receipt
                          .reviewNote
                      }
                    </strong>
                  </div>
                ) : null}

                {preview
                  .receipt
                  .reversalReason ? (
                  <div className="admin-receipt-long-detail">
                    <span>
                      Motivo da reversão
                    </span>

                    <strong>
                      {
                        preview
                          .receipt
                          .reversalReason
                      }
                    </strong>
                  </div>
                ) : null}
              </div>

              {/* =============================================
                  ACTIONS
              ============================================= */}

              {!action ? (
                <div className="admin-receipt-review-footer">
                  {preview
                    .receipt
                    .status ===
                  'PENDING' ? (
                    <>
                      <button
                        type="button"
                        className="admin-receipt-approve-button"
                        onClick={() => {
                          startAction(
                            'APPROVE',
                          );
                        }}
                      >
                        <ThumbsUp
                          size={17}
                        />

                        Aprovar
                      </button>

                      <button
                        type="button"
                        className="admin-receipt-reject-button"
                        onClick={() => {
                          startAction(
                            'REJECT',
                          );
                        }}
                      >
                        <XCircle
                          size={17}
                        />

                        Rejeitar
                      </button>
                    </>
                  ) : null}

                  {preview
                    .receipt
                    .status ===
                  'APPROVED' ? (
                    <button
                      type="button"
                      className="admin-receipt-reverse-button"
                      onClick={() => {
                        startAction(
                          'REVERSE',
                        );
                      }}
                    >
                      <RotateCcw
                        size={17}
                      />

                      Reverter aprovação
                    </button>
                  ) : null}

                  <div className="receipt-preview-security">
                    <ShieldCheck
                      size={17}
                    />

                    <div>
                      <strong>
                        Operação auditável
                      </strong>

                      <span>
                        As ações administrativas ficam registradas
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <form
                  className="admin-receipt-action-panel"
                  onSubmit={(
                    event,
                  ) => {
                    void executeAction(
                      event,
                    );
                  }}
                >
                  <div className="admin-receipt-action-heading">
                    <div>
                      <span className="section-kicker">
                        CONFIRMAÇÃO
                      </span>

                      <h3>
                        {actionTitle(
                          action,
                        )}
                      </h3>
                    </div>

                    <button
                      type="button"
                      aria-label="Voltar"
                      onClick={
                        cancelAction
                      }
                    >
                      <X
                        size={17}
                      />
                    </button>
                  </div>

                  <p>
                    {actionDescription(
                      action,
                    )}
                  </p>

                  <label>
                    <span>
                      {action ===
                      'APPROVE'
                        ? 'Observação opcional'
                        : 'Motivo obrigatório'}
                    </span>

                    <textarea
                      value={
                        actionText
                      }
                      maxLength={
                        500
                      }
                      required={
                        action !==
                        'APPROVE'
                      }
                      placeholder={
                        action ===
                        'APPROVE'
                          ? 'Ex.: Comprovante conferido.'
                          : 'Descreva o motivo...'
                      }
                      onChange={(
                        event,
                      ) => {
                        setActionText(
                          event
                            .target
                            .value,
                        );
                      }}
                    />
                  </label>

                  <div className="admin-receipt-action-buttons">
                    <button
                      type="button"
                      className="admin-action-back"
                      disabled={
                        actionLoading
                      }
                      onClick={
                        cancelAction
                      }
                    >
                      Voltar
                    </button>

                    <button
                      type="submit"
                      className={
                        action ===
                        'APPROVE'
                          ? 'admin-action-confirm approve'
                          : action ===
                            'REJECT'
                            ? 'admin-action-confirm reject'
                            : 'admin-action-confirm reverse'
                      }
                      disabled={
                        actionLoading
                      }
                    >
                      {actionLoading ? (
                        <LoaderCircle
                          size={17}
                          className="spin"
                        />
                      ) : action ===
                        'APPROVE' ? (
                        <ThumbsUp
                          size={17}
                        />
                      ) : action ===
                        'REJECT' ? (
                        <XCircle
                          size={17}
                        />
                      ) : (
                        <RotateCcw
                          size={17}
                        />
                      )}

                      {actionLoading
                        ? 'Processando...'
                        : actionTitle(
                            action,
                          )}
                    </button>
                  </div>
                </form>
              )}
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}