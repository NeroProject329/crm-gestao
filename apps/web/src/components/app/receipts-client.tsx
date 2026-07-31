'use client';

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import {
  CalendarDays,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileText,
  LoaderCircle,
  RefreshCw,
  Send,
  UploadCloud,
  X,
} from 'lucide-react';

import {
  gsap,
} from 'gsap';

import type {
  EmployeeReceiptView,
  ReceiptFileUrlResponse,
  ReceiptStatus,
  ReceiptUploadInitResponse,
} from '@crm/contracts';

import {
  apiRequest,
} from '@/lib/api';

import {
  formatBRL,
  formatBusinessDate,
} from '@/lib/format';

const MAX_FILE_BYTES =
  10 *
  1024 *
  1024;

const ALLOWED_MIME_TYPES =
  new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
  ]);

type ReceiptFilter =
  | 'ALL'
  | ReceiptStatus;

interface ReceiptPreview {
  receipt:
    EmployeeReceiptView;

  url:
    string;
}

const FILTERS: Array<{
  value: ReceiptFilter;
  label: string;
}> = [
  {
    value: 'ALL',
    label: 'Todos',
  },
  {
    value: 'PENDING',
    label: 'Pendentes',
  },
  {
    value: 'APPROVED',
    label: 'Aprovados',
  },
  {
    value: 'REJECTED',
    label: 'Negados',
  },
  {
    value: 'CANCELED',
    label: 'Cancelados',
  },
  {
    value: 'REVERSED',
    label: 'Revertidos',
  },
];

function statusLabel(
  status:
    ReceiptStatus,
): string {
  switch (status) {
    case 'PENDING':
      return 'Pendente';

    case 'APPROVED':
      return 'Aprovado';

    case 'REJECTED':
      return 'Negado';

    case 'CANCELED':
      return 'Cancelado';

    case 'REVERSED':
      return 'Revertido';
  }
}

function toLocalDatetimeValue():
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
    .slice(
      0,
      16,
    );
}

function normalizeMoney(
  value:
    string,
): string {
  return value
    .trim()
    .replace(
      ',',
      '.',
    );
}

function validMoney(
  value:
    string,
): boolean {
  return /^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/
    .test(
      normalizeMoney(
        value,
      ),
    );
}

function formatFileSize(
  bytes:
    number,
): string {
  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 *
      1024
  ) {
    return `${Math.round(
      bytes /
        1024,
    )} KB`;
  }

  return `${(
    bytes /
    (
      1024 *
      1024
    )
  ).toFixed(1)} MB`;
}

export function ReceiptsClient() {
  const [
    receipts,
    setReceipts,
  ] =
    useState<
      EmployeeReceiptView[]
    >(
      [],
    );

  const [
    status,
    setStatus,
  ] =
    useState<ReceiptFilter>(
      'ALL',
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
    amount,
    setAmount,
  ] =
    useState(
      '',
    );

  const [
    payerName,
    setPayerName,
  ] =
    useState(
      '',
    );

  const [
    paidAt,
    setPaidAt,
  ] =
    useState(
      toLocalDatetimeValue(),
    );

  const [
    file,
    setFile,
  ] =
    useState<File | null>(
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
    submitting,
    setSubmitting,
  ] =
    useState(
      false,
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
      ReceiptPreview | null
    >(
      null,
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
     MODAL / PREVIEW
  ======================================================= */

  useEffect(() => {
    if (!preview) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style
      .overflow =
      'hidden';

    const handleKeyDown =
      (
        event:
          KeyboardEvent,
      ): void => {
        if (
          event.key ===
          'Escape'
        ) {
          setPreview(
            null,
          );
        }
      };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style
        .overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    preview,
  ]);

  /* =======================================================
     ENTRANCE ANIMATIONS
  ======================================================= */

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
          '.receipt-reveal',
          {
            opacity:
              0,

            y:
              24,
          },
          {
            opacity:
              1,

            y:
              0,

            duration:
              0.65,

            stagger:
              0.07,

            ease:
              'power3.out',
          },
        );
      });

    return () => {
      context.revert();
    };
  }, []);

  /* =======================================================
     LOAD RECEIPTS
  ======================================================= */

  const load =
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
              EmployeeReceiptView[]
            >(
              `/me/receipts${suffix}`,
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
        from,
        to,
      ],
    );

  useLayoutEffect(() => {
    void load();
  }, [
    load,
  ]);

  /* =======================================================
     FILE SELECTION
  ======================================================= */

  function handleFileChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ): void {
    setError(
      null,
    );

    setSuccess(
      null,
    );

    const selected =
      event
        .target
        .files?.[
          0
        ] ??
      null;

    if (!selected) {
      setFile(
        null,
      );

      return;
    }

    if (
      !ALLOWED_MIME_TYPES
        .has(
          selected.type,
        )
    ) {
      setFile(
        null,
      );

      setError(
        'Use um arquivo PDF, JPG ou PNG.',
      );

      event.target.value =
        '';

      return;
    }

    if (
      selected.size >
      MAX_FILE_BYTES
    ) {
      setFile(
        null,
      );

      setError(
        'O arquivo deve ter no máximo 10 MB.',
      );

      event.target.value =
        '';

      return;
    }

    setFile(
      selected,
    );
  }

  /* =======================================================
     SUBMIT RECEIPT
  ======================================================= */

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setError(
      null,
    );

    setSuccess(
      null,
    );

    const normalizedAmount =
      normalizeMoney(
        amount,
      );

    if (
      !validMoney(
        normalizedAmount,
      )
    ) {
      setError(
        'Informe um valor válido, por exemplo 1500.00.',
      );

      return;
    }

    if (
      payerName
        .trim()
        .length <
      2
    ) {
      setError(
        'Informe o nome do pagador.',
      );

      return;
    }

    if (!paidAt) {
      setError(
        'Informe a data e hora do pagamento.',
      );

      return;
    }

    if (!file) {
      setError(
        'Selecione o comprovante.',
      );

      return;
    }

    setSubmitting(
      true,
    );

    try {
      /* ---------------------------------------------------
         1. Solicita presigned URL
      --------------------------------------------------- */

      const init =
        await apiRequest<
          ReceiptUploadInitResponse
        >(
          '/me/receipt-uploads/init',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                mimeType:
                  file.type,

                sizeBytes:
                  file.size,
              }),
          },
        );

      /* ---------------------------------------------------
         2. Browser envia arquivo direto para o R2
      --------------------------------------------------- */

      const upload =
        await fetch(
          init.uploadUrl,
          {
            method:
              init.method,

            headers:
              init.headers,

            body:
              file,

            credentials:
              'omit',
          },
        );

      if (
        !upload.ok
      ) {
        throw new Error(
          `Falha ao enviar o arquivo para o storage (${upload.status}).`,
        );
      }

      /* ---------------------------------------------------
         3. Registra comprovante no CRM
      --------------------------------------------------- */

      const paidAtIso =
        new Date(
          paidAt,
        )
          .toISOString();

      await apiRequest<
        EmployeeReceiptView
      >(
        '/me/receipts',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              amount:
                normalizedAmount,

              payerName:
                payerName
                  .trim(),

              paidAt:
                paidAtIso,

              uploadToken:
                init.uploadToken,
            }),
        },
      );

      /* ---------------------------------------------------
         4. Limpa formulário
      --------------------------------------------------- */

      setAmount(
        '',
      );

      setPayerName(
        '',
      );

      setPaidAt(
        toLocalDatetimeValue(),
      );

      setFile(
        null,
      );

      const fileInput =
        document.getElementById(
          'receipt-file',
        ) as
          | HTMLInputElement
          | null;

      if (
        fileInput
      ) {
        fileInput.value =
          '';
      }

      setSuccess(
        'Comprovante enviado. Ele está aguardando análise.',
      );

      await load();
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível enviar o comprovante.',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  /* =======================================================
     INTERNAL PREVIEW
  ======================================================= */

  async function openFile(
    receipt:
      EmployeeReceiptView,
  ): Promise<void> {
    setError(
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
          `/me/receipts/${receipt.id}/file-url`,
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
          : 'Não foi possível visualizar o comprovante.',
      );
    } finally {
      setBusyReceiptId(
        null,
      );
    }
  }

  /* =======================================================
     CANCEL RECEIPT
  ======================================================= */

  async function cancelReceipt(
    receiptId:
      string,
  ): Promise<void> {
    const confirmed =
      window.confirm(
        'Deseja cancelar este comprovante pendente?',
      );

    if (
      !confirmed
    ) {
      return;
    }

    setError(
      null,
    );

    setSuccess(
      null,
    );

    setBusyReceiptId(
      receiptId,
    );

    try {
      await apiRequest<
        EmployeeReceiptView
      >(
        `/me/receipts/${receiptId}/cancel`,
        {
          method:
            'POST',
        },
      );

      setSuccess(
        'Comprovante cancelado.',
      );

      setPreview(
        null,
      );

      await load();
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível cancelar o comprovante.',
      );
    } finally {
      setBusyReceiptId(
        null,
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section className="receipts-page">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="receipts-header receipt-reveal">
        <div>
          <span className="section-kicker">
            COMPROVANTES
          </span>

          <h1>
            Registre seus
            <br />
            pagamentos.
          </h1>

          <p>
            Envie o comprovante e acompanhe
            o status da análise sem precisar
            informar faturamento manualmente.
          </p>
        </div>

        <div className="receipt-security-card">
          <FileCheck2
            size={
              24
            }
          />

          <div>
            <strong>
              Arquivo privado
            </strong>

            <span>
              PDF, JPG ou PNG • até 10 MB
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================
          FORM + EXPLANATION
      ================================================== */}

      <div className="receipts-layout">
        <article className="receipt-upload-card receipt-reveal">
          <div className="finance-card-heading">
            <div>
              <span className="section-kicker">
                NOVO ENVIO
              </span>

              <h2>
                Enviar comprovante
              </h2>
            </div>

            <UploadCloud
              size={
                23
              }
            />
          </div>

          <form
            className="receipt-form"
            onSubmit={(
              event,
            ) => {
              void submit(
                event,
              );
            }}
          >
            {/* VALOR */}

            <label>
              <span>
                Valor recebido
              </span>

              <div className="receipt-money-input">
                <span>
                  R$
                </span>

                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="1500.00"
                  value={
                    amount
                  }
                  maxLength={
                    15
                  }
                  required
                  onChange={(
                    event,
                  ) => {
                    setAmount(
                      event
                        .target
                        .value,
                    );
                  }}
                />
              </div>
            </label>

            {/* PAGADOR */}

            <label>
              <span>
                Nome do pagador
              </span>

              <input
                type="text"
                maxLength={
                  160
                }
                placeholder="Nome completo"
                value={
                  payerName
                }
                required
                onChange={(
                  event,
                ) => {
                  setPayerName(
                    event
                      .target
                      .value,
                  );
                }}
              />
            </label>

            {/* DATA */}

            <label>
              <span>
                Data e hora do pagamento
              </span>

              <input
                type="datetime-local"
                value={
                  paidAt
                }
                required
                onChange={(
                  event,
                ) => {
                  setPaidAt(
                    event
                      .target
                      .value,
                  );
                }}
              />
            </label>

            {/* ARQUIVO */}

            <label className="receipt-file-field">
              <span>
                Arquivo
              </span>

              <input
                id="receipt-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                required
                onChange={
                  handleFileChange
                }
              />

              <div className="receipt-file-drop">
                <UploadCloud
                  size={
                    26
                  }
                />

                {file ? (
                  <>
                    <strong>
                      {
                        file.name
                      }
                    </strong>

                    <small>
                      {formatFileSize(
                        file.size,
                      )}
                    </small>
                  </>
                ) : (
                  <>
                    <strong>
                      Selecione o comprovante
                    </strong>

                    <small>
                      PDF, JPG ou PNG
                    </small>
                  </>
                )}
              </div>
            </label>

            {/* SUBMIT */}

            <button
              type="submit"
              className="receipt-submit-button"
              disabled={
                submitting
              }
            >
              {submitting ? (
                <LoaderCircle
                  size={
                    19
                  }
                  className="spin"
                />
              ) : (
                <Send
                  size={
                    19
                  }
                />
              )}

              {submitting
                ? 'Enviando...'
                : 'Enviar comprovante'}
            </button>
          </form>
        </article>

        {/* =================================================
            FLOW CARD
        ================================================= */}

        <article className="receipt-flow-card receipt-reveal">
          <span className="section-kicker">
            COMO FUNCIONA
          </span>

          <h2>
            Do envio ao faturamento
          </h2>

          <div className="receipt-flow-list">
            <div>
              <span>
                01
              </span>

              <div>
                <strong>
                  Você envia
                </strong>

                <p>
                  O arquivo vai diretamente
                  para o storage privado.
                </p>
              </div>
            </div>

            <div>
              <span>
                02
              </span>

              <div>
                <strong>
                  Fica pendente
                </strong>

                <p>
                  O administrador recebe
                  a solicitação para análise.
                </p>
              </div>
            </div>

            <div>
              <span>
                03
              </span>

              <div>
                <strong>
                  Após aprovação
                </strong>

                <p>
                  O valor passa a compor
                  seu faturamento oficial.
                </p>
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* ==================================================
          FEEDBACK
      ================================================== */}

      {error ? (
        <div className="dashboard-error receipt-reveal">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="receipt-success receipt-reveal">
          <CheckCircle2
            size={
              19
            }
          />

          {success}
        </div>
      ) : null}

      {/* ==================================================
          HISTORY
      ================================================== */}

      <article className="receipt-history-card receipt-reveal">
        <div className="finance-card-heading">
          <div>
            <span className="section-kicker">
              HISTÓRICO
            </span>

            <h2>
              Meus comprovantes
            </h2>
          </div>

          <button
            type="button"
            className="receipt-refresh-button"
            disabled={
              loading
            }
            onClick={() => {
              void load();
            }}
          >
            <RefreshCw
              size={
                17
              }
              className={
                loading
                  ? 'spin'
                  : undefined
              }
            />

            Atualizar
          </button>
        </div>

        {/* FILTERS */}

        <div className="receipt-filter-bar">
          <div className="receipt-status-filters">
            {FILTERS.map(
              (
                item,
              ) => (
                <button
                  key={
                    item.value
                  }
                  type="button"
                  className={
                    status ===
                    item.value
                      ? 'receipt-filter active'
                      : 'receipt-filter'
                  }
                  onClick={() => {
                    setStatus(
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

          <div className="receipt-date-filters">
            <label>
              <CalendarDays
                size={
                  16
                }
              />

              <input
                type="date"
                value={
                  from
                }
                aria-label="Data inicial"
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

            <span>
              até
            </span>

            <label>
              <input
                type="date"
                value={
                  to
                }
                aria-label="Data final"
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
                className="receipt-clear-dates"
                title="Limpar datas"
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
                  size={
                    16
                  }
                />
              </button>
            ) : null}
          </div>
        </div>

        {/* CONTENT */}

        {loading &&
        receipts.length ===
          0 ? (
          <div className="finance-empty-state">
            <LoaderCircle
              size={
                24
              }
              className="spin"
            />

            Carregando comprovantes...
          </div>
        ) : receipts.length ===
          0 ? (
          <div className="receipt-empty">
            <FileText
              size={
                31
              }
            />

            <strong>
              Nenhum comprovante
            </strong>

            <span>
              Não há registros para
              os filtros selecionados.
            </span>
          </div>
        ) : (
          <div className="receipt-table-scroll">
            <table className="receipt-table">
              <thead>
                <tr>
                  <th>
                    Pagador
                  </th>

                  <th>
                    Valor
                  </th>

                  <th>
                    Data do pagamento
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Arquivo
                  </th>

                  <th>
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {receipts.map(
                  (
                    receipt,
                  ) => {
                    const busy =
                      busyReceiptId ===
                      receipt.id;

                    return (
                      <tr
                        key={
                          receipt.id
                        }
                      >
                        {/* PAGADOR */}

                        <td>
                          <strong>
                            {
                              receipt
                                .payerName
                            }
                          </strong>

                          <small>
                            Enviado em{' '}
                            {new Date(
                              receipt
                                .createdAt,
                            ).toLocaleDateString(
                              'pt-BR',
                            )}
                          </small>
                        </td>

                        {/* VALUE */}

                        <td>
                          {formatBRL(
                            receipt
                              .amount,
                          )}
                        </td>

                        {/* DATE */}

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

                        {/* STATUS */}

                        <td>
                          <span
                            className={`receipt-status ${receipt.status.toLowerCase()}`}
                          >
                            {statusLabel(
                              receipt
                                .status,
                            )}
                          </span>
                        </td>

                        {/* FILE */}

                        <td>
                          <span className="receipt-file-meta">
                            <FileText
                              size={
                                16
                              }
                            />

                            {receipt.file
                              .mimeType ===
                            'application/pdf'
                              ? 'PDF'
                              : 'Imagem'}

                            <small>
                              {formatFileSize(
                                receipt
                                  .file
                                  .sizeBytes,
                              )}
                            </small>
                          </span>
                        </td>

                        {/* ACTIONS */}

                        <td>
                          <div className="receipt-actions">
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() => {
                                void openFile(
                                  receipt,
                                );
                              }}
                            >
                              {busy ? (
                                <LoaderCircle
                                  size={
                                    16
                                  }
                                  className="spin"
                                />
                              ) : (
                                <Eye
                                  size={
                                    16
                                  }
                                />
                              )}

                              Visualizar
                            </button>

                            {receipt.status ===
                            'PENDING' ? (
                              <button
                                type="button"
                                className="danger"
                                disabled={
                                  busy
                                }
                                onClick={() => {
                                  void cancelReceipt(
                                    receipt.id,
                                  );
                                }}
                              >
                                <X
                                  size={
                                    16
                                  }
                                />

                                Cancelar
                              </button>
                            ) : null}
                          </div>
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
          INTERNAL RECEIPT VIEWER
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
              event.currentTarget
            ) {
              setPreview(
                null,
              );
            }
          }}
        >
          <div
            className="receipt-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Visualização do comprovante"
          >
            {/* =============================================
                LEFT SIDE — FILE
            ============================================= */}

            <div className="receipt-preview-main">
              <div className="receipt-preview-topbar">
                <div>
                  <FileText
                    size={
                      18
                    }
                  />

                  <span>
                    Comprovante
                  </span>
                </div>

                <button
                    type="button"
                    className="receipt-preview-close"
                    aria-label="Fechar visualização"
                    onClick={() => {
                        setPreview(
                        null,
                        );
                    }}
                    >
                    <X
                        size={
                        18
                        }
                    />

                    <span>
                        Fechar
                    </span>
                </button>'
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
                RIGHT SIDE — INFORMATION
            ============================================= */}

            <aside className="receipt-preview-info">
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

              {/* VALUE */}

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

              {/* DETAILS */}

              <div className="receipt-preview-details">
                <div>
                  <span>
                    Pagador
                  </span>

                  <strong
                    title={
                      preview
                        .receipt
                        .payerName
                    }
                  >
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

                <div>
                  <span>
                    Enviado em
                  </span>

                  <strong>
                    {new Date(
                      preview
                        .receipt
                        .createdAt,
                    ).toLocaleString(
                      'pt-BR',
                      {
                        day:
                          '2-digit',

                        month:
                          '2-digit',

                        year:
                          'numeric',

                        hour:
                          '2-digit',

                        minute:
                          '2-digit',
                      },
                    )}
                  </strong>
                </div>
              </div>

              {/* FOOTER */}

              <div className="receipt-preview-footer">
                <div className="receipt-preview-security">
                  <FileCheck2
                    size={
                      17
                    }
                  />

                  <div>
                    <strong>
                      Arquivo privado
                    </strong>

                    <span>
                      Visualização temporária e segura
                    </span>
                  </div>
                </div>

                {preview
                  .receipt
                  .status ===
                'PENDING' ? (
                  <button
                    type="button"
                    className="receipt-preview-cancel"
                    onClick={() => {
                      const receiptId =
                        preview
                          .receipt
                          .id;

                      setPreview(
                        null,
                      );

                      void cancelReceipt(
                        receiptId,
                      );
                    }}
                  >
                    <X
                      size={
                        16
                      }
                    />

                    Cancelar comprovante
                  </button>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}