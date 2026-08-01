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
  CalendarDays,
  CheckCircle2,
  CircleOff,
  Edit3,
  History,
  LoaderCircle,
  Mail,
  Plus,
  Power,
  PowerOff,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';

import {
  gsap,
} from 'gsap';

import type {
  AdminEmployeeView,
  EmployeeCommissionPolicyView,
} from '@crm/contracts';

import {
  apiRequest,
} from '@/lib/api';

type EmployeeFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'INACTIVE';

type EmployeeDialog =
  | {
      type: 'CREATE';
    }
  | {
      type: 'EDIT';
      employee: AdminEmployeeView;
    }
  | {
      type: 'COMMISSION';
      employee: AdminEmployeeView;
    }
  | null;

interface EmployeeForm {
  name: string;
  email: string;
  initialPassword: string;
  commissionPercentage: string;
  effectiveFrom: string;
}

function localDate(): string {
  const date =
    new Date();

  const offset =
    date.getTimezoneOffset();

  return new Date(
    date.getTime() -
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
  EmployeeForm {
  return {
    name: '',
    email: '',
    initialPassword: '',
    commissionPercentage: '',
    effectiveFrom:
      localDate(),
  };
}

function percentageToBps(
  value: string,
): number | null {
  const normalized =
    value
      .trim()
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
    percentage < 0 ||
    percentage > 100
  ) {
    return null;
  }

  return Math.round(
    percentage *
      100,
  );
}

function formatPercentage(
  bps: number,
): string {
  return (
    bps /
    100
  ).toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        2,
    },
  ) + '%';
}

function formatDate(
  value:
    | string
    | null,
): string {
  if (!value) {
    return 'Atual';
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split('-')
      .map(Number);

  return new Date(
    year,
    month - 1,
    day,
  ).toLocaleDateString(
    'pt-BR',
  );
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

export function AdminEmployeesClient() {
  const [
    employees,
    setEmployees,
  ] =
    useState<
      AdminEmployeeView[]
    >([]);

  const [
    commissionHistory,
    setCommissionHistory,
  ] =
    useState<
      Record<
        string,
        EmployeeCommissionPolicyView[]
      >
    >({});

  const [
    filter,
    setFilter,
  ] =
    useState<
      EmployeeFilter
    >(
      'ALL',
    );

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
      EmployeeDialog
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<
      EmployeeForm
    >(
      emptyForm,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    busyEmployeeId,
    setBusyEmployeeId,
  ] =
    useState<
      string | null
    >(null);

  const [
    commissionLoadingId,
    setCommissionLoadingId,
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

  const loadEmployees =
    useCallback(
      async (): Promise<void> => {
        setLoading(
          true,
        );

        setError(
          null,
        );

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
        } finally {
          setLoading(
            false,
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

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeout =
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
        timeout,
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
            '[data-employee-reveal]',
            {
              opacity: 0,
              y: 22,
            },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
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
    employees.length,
  ]);

  const statistics =
    useMemo(
      () => {
        const active =
          employees.filter(
            (
              employee,
            ) =>
              employee.active,
          ).length;

        return {
          total:
            employees.length,

          active,

          inactive:
            employees.length -
            active,
        };
      },
      [
        employees,
      ],
    );

  const visibleEmployees =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLocaleLowerCase(
              'pt-BR',
            );

        return employees
          .filter(
            (
              employee,
            ) => {
              if (
                filter ===
                  'ACTIVE' &&
                !employee.active
              ) {
                return false;
              }

              if (
                filter ===
                  'INACTIVE' &&
                employee.active
              ) {
                return false;
              }

              if (!query) {
                return true;
              }

              return (
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
                  )
              );
            },
          )
          .sort(
            (
              first,
              second,
            ) => {
              if (
                first.active !==
                second.active
              ) {
                return first.active
                  ? -1
                  : 1;
              }

              return first
                .name
                .localeCompare(
                  second.name,
                  'pt-BR',
                );
            },
          );
      },
      [
        employees,
        filter,
        search,
      ],
    );

  function updateForm(
    field:
      keyof EmployeeForm,

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
    employee:
      AdminEmployeeView,
  ): void {
    setError(
      null,
    );

    setSuccess(
      null,
    );

    setForm({
      ...emptyForm(),

      name:
        employee.name,

      email:
        employee.email,
    });

    setDialog({
      type:
        'EDIT',

      employee,
    });
  }

  async function loadCommissionHistory(
    employeeId:
      string,
  ): Promise<void> {
    setCommissionLoadingId(
      employeeId,
    );

    try {
      const history =
        await apiRequest<
          EmployeeCommissionPolicyView[]
        >(
          `/admin/employees/${employeeId}/commissions`,
        );

      setCommissionHistory(
        (
          current,
        ) => ({
          ...current,

          [employeeId]:
            history,
        }),
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível carregar o histórico de comissões.',
      );
    } finally {
      setCommissionLoadingId(
        null,
      );
    }
  }

  function openCommission(
    employee:
      AdminEmployeeView,
  ): void {
    setError(
      null,
    );

    setSuccess(
      null,
    );

    setForm({
      ...emptyForm(),

      name:
        employee.name,

      email:
        employee.email,
    });

    setDialog({
      type:
        'COMMISSION',

      employee,
    });

    void loadCommissionHistory(
      employee
        .employeeId,
    );
  }

  async function submitCreate(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const name =
      form
        .name
        .trim();

    const email =
      form
        .email
        .trim()
        .toLowerCase();

    const percentageBps =
      percentageToBps(
        form
          .commissionPercentage,
      );

    if (
      name.length <
      2
    ) {
      setError(
        'Informe o nome do funcionário.',
      );

      return;
    }

    if (!email) {
      setError(
        'Informe o e-mail do funcionário.',
      );

      return;
    }

    if (
      form
        .initialPassword
        .length <
      12
    ) {
      setError(
        'A senha inicial precisa ter pelo menos 12 caracteres.',
      );

      return;
    }

    if (
      percentageBps ===
      null
    ) {
      setError(
        'Informe uma comissão entre 0% e 100%.',
      );

      return;
    }

    if (
      !form
        .effectiveFrom
    ) {
      setError(
        'Informe a data inicial da comissão.',
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
      const created =
        await apiRequest<
          AdminEmployeeView
        >(
          '/admin/employees',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                name,

                email,

                initialPassword:
                  form
                    .initialPassword,

                commissionPercentageBps:
                  percentageBps,

                commissionEffectiveFrom:
                  form
                    .effectiveFrom,
              }),
          },
        );

      setEmployees(
        (
          current,
        ) => [
          created,

          ...current.filter(
            (
              employee,
            ) =>
              employee
                .employeeId !==
              created
                .employeeId,
          ),
        ],
      );

      setDialog(
        null,
      );

      setForm(
        emptyForm(),
      );

      setSuccess(
        'Funcionário criado com sucesso.',
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível criar o funcionário.',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  async function submitEdit(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      dialog?.type !==
      'EDIT'
    ) {
      return;
    }

    const name =
      form
        .name
        .trim();

    const email =
      form
        .email
        .trim()
        .toLowerCase();

    if (
      name.length <
      2
    ) {
      setError(
        'Informe o nome do funcionário.',
      );

      return;
    }

    if (!email) {
      setError(
        'Informe o e-mail do funcionário.',
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
      const updated =
        await apiRequest<
          AdminEmployeeView
        >(
          `/admin/employees/${dialog.employee.employeeId}`,
          {
            method:
              'PATCH',

            body:
              JSON.stringify({
                name,
                email,
              }),
          },
        );

      setEmployees(
        (
          current,
        ) =>
          current.map(
            (
              employee,
            ) =>
              employee
                .employeeId ===
              updated
                .employeeId
                ? updated
                : employee,
          ),
      );

      setDialog(
        null,
      );

      setSuccess(
        'Dados do funcionário atualizados.',
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível atualizar o funcionário.',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  async function submitCommission(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      dialog?.type !==
      'COMMISSION'
    ) {
      return;
    }

    const percentageBps =
      percentageToBps(
        form
          .commissionPercentage,
      );

    if (
      percentageBps ===
      null
    ) {
      setError(
        'Informe uma comissão entre 0% e 100%.',
      );

      return;
    }

    if (
      !form
        .effectiveFrom
    ) {
      setError(
        'Informe a data de vigência.',
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
        EmployeeCommissionPolicyView
      >(
        `/admin/employees/${dialog.employee.employeeId}/commissions/set`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              percentageBps,

              effectiveFrom:
                form
                  .effectiveFrom,
            }),
        },
      );

      await loadCommissionHistory(
        dialog
          .employee
          .employeeId,
      );

      setForm(
        (
          current,
        ) => ({
          ...current,

          commissionPercentage:
            '',

          effectiveFrom:
            localDate(),
        }),
      );

      setSuccess(
        'Nova política de comissão registrada.',
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível registrar a comissão.',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  async function changeStatus(
    employee:
      AdminEmployeeView,
  ): Promise<void> {
    const action =
      employee.active
        ? 'deactivate'
        : 'activate';

    const message =
      employee.active
        ? `Desativar ${employee.name}? As sessões atuais serão revogadas.`
        : `Ativar ${employee.name}?`;

    const confirmed =
      window.confirm(
        message,
      );

    if (!confirmed) {
      return;
    }

    setBusyEmployeeId(
      employee
        .employeeId,
    );

    setError(
      null,
    );

    setSuccess(
      null,
    );

    try {
      const updated =
        await apiRequest<
          AdminEmployeeView
        >(
          `/admin/employees/${employee.employeeId}/${action}`,
          {
            method:
              'POST',
          },
        );

      setEmployees(
        (
          current,
        ) =>
          current.map(
            (
              item,
            ) =>
              item
                .employeeId ===
              updated
                .employeeId
                ? updated
                : item,
          ),
      );

      setSuccess(
        updated.active
          ? 'Funcionário ativado.'
          : 'Funcionário desativado.',
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Não foi possível alterar o status do funcionário.',
      );
    } finally {
      setBusyEmployeeId(
        null,
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
          Carregando funcionários...
        </span>
      </main>
    );
  }

  return (
    <section className="admin-employees-page">
      {success ? (
        <div className="employees-toast success">
          <CheckCircle2
            size={18}
          />

          {success}
        </div>
      ) : null}

      <header
        className="employees-hero"
        data-employee-reveal
      >
        <div>
          <span className="section-kicker">
            EQUIPE E COMISSÕES
          </span>

          <h1>
            Gestão de
            <br />
            funcionários.
          </h1>

          <p>
            Cadastre usuários, controle acessos e
            preserve o histórico de comissões por
            data de vigência.
          </p>
        </div>

        <button
          type="button"
          className="employees-primary-action"
          onClick={
            openCreate
          }
        >
          <UserPlus
            size={19}
          />

          Novo funcionário
        </button>
      </header>

      <div
        className="employees-statistics"
        data-employee-reveal
      >
        <article>
          <div className="employees-stat-icon">
            <UsersRound
              size={21}
            />
          </div>

          <span>
            Total cadastrado
          </span>

          <strong>
            {statistics.total}
          </strong>
        </article>

        <article>
          <div className="employees-stat-icon active">
            <ShieldCheck
              size={21}
            />
          </div>

          <span>
            Funcionários ativos
          </span>

          <strong>
            {statistics.active}
          </strong>
        </article>

        <article>
          <div className="employees-stat-icon inactive">
            <CircleOff
              size={21}
            />
          </div>

          <span>
            Funcionários inativos
          </span>

          <strong>
            {statistics.inactive}
          </strong>
        </article>
      </div>

      <div
        className="employees-toolbar"
        data-employee-reveal
      >
        <label className="employees-search">
          <Search
            size={18}
          />

          <input
            type="search"
            value={
              search
            }
            placeholder="Buscar por nome ou e-mail"
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

        <div className="employees-filter-list">
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
                'INACTIVE',

              label:
                'Inativos',
            },
          ] as const).map(
            (
              item,
            ) => (
              <button
                key={
                  item.value
                }
                type="button"
                className={
                  filter ===
                  item.value
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  setFilter(
                    item.value,
                  );
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      </div>

      {error && !dialog ? (
        <div className="dashboard-error">
          {error}

          <button
            type="button"
            onClick={() => {
              void loadEmployees();
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {visibleEmployees.length ===
      0 ? (
        <div
          className="employees-empty"
          data-employee-reveal
        >
          <UsersRound
            size={34}
          />

          <strong>
            Nenhum funcionário encontrado
          </strong>

          <span>
            Ajuste os filtros ou cadastre um novo
            funcionário.
          </span>
        </div>
      ) : (
        <div className="employees-list">
          {visibleEmployees.map(
            (
              employee,
            ) => {
              const busy =
                busyEmployeeId ===
                employee
                  .employeeId;

              return (
                <article
                  key={
                    employee
                      .employeeId
                  }
                  className={[
                    'employee-management-card',

                    employee.active
                      ? 'active'
                      : 'inactive',
                  ].join(' ')}
                  data-employee-reveal
                >
                  <div className="employee-management-person">
                    <div className="employee-management-avatar">
                      {initials(
                        employee.name,
                      )}
                    </div>

                    <div>
                      <div className="employee-name-line">
                        <h2>
                          {employee.name}
                        </h2>

                        <span
                          className={[
                            'employee-status-badge',

                            employee.active
                              ? 'active'
                              : 'inactive',
                          ].join(' ')}
                        >
                          {employee.active
                            ? 'Ativo'
                            : 'Inativo'}
                        </span>
                      </div>

                      <p>
                        <Mail
                          size={15}
                        />

                        {employee.email}
                      </p>
                    </div>
                  </div>

                  <div className="employee-management-meta">
                    <div>
                      <span>
                        Cadastrado em
                      </span>

                      <strong>
                        {new Date(
                          employee
                            .createdAt,
                        ).toLocaleDateString(
                          'pt-BR',
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Identificador
                      </span>

                      <strong title={employee.employeeId}>
                        {employee
                          .employeeId
                          .slice(
                            0,
                            8,
                          )}
                      </strong>
                    </div>
                  </div>

                  <div className="employee-management-actions">
                    <button
                      type="button"
                      onClick={() => {
                        openEdit(
                          employee,
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
                      onClick={() => {
                        openCommission(
                          employee,
                        );
                      }}
                    >
                      <BadgePercent
                        size={16}
                      />

                      Comissão
                    </button>

                    <button
                      type="button"
                      className={
                        employee.active
                          ? 'danger'
                          : 'success'
                      }
                      disabled={
                        busy
                      }
                      onClick={() => {
                        void changeStatus(
                          employee,
                        );
                      }}
                    >
                      {busy ? (
                        <LoaderCircle
                          size={16}
                          className="spin"
                        />
                      ) : employee.active ? (
                        <PowerOff
                          size={16}
                        />
                      ) : (
                        <Power
                          size={16}
                        />
                      )}

                      {employee.active
                        ? 'Desativar'
                        : 'Ativar'}
                    </button>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}

      {dialog ? (
        <div
          className="employees-modal-backdrop"
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
            className={[
              'employees-modal',

              dialog.type ===
              'COMMISSION'
                ? 'commission-modal'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-modal-title"
          >
            <header className="employees-modal-header">
              <div>
                <span className="section-kicker">
                  {dialog.type ===
                  'CREATE'
                    ? 'NOVO ACESSO'
                    : dialog.type ===
                        'EDIT'
                      ? 'DADOS DO USUÁRIO'
                      : 'POLÍTICA FINANCEIRA'}
                </span>

                <h2 id="employee-modal-title">
                  {dialog.type ===
                  'CREATE'
                    ? 'Cadastrar funcionário'
                    : dialog.type ===
                        'EDIT'
                      ? 'Editar funcionário'
                      : `Comissão de ${dialog.employee.name}`}
                </h2>
              </div>

              <button
                type="button"
                className="employees-modal-close"
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
              <div className="employees-modal-error">
                {error}
              </div>
            ) : null}

            {dialog.type ===
            'CREATE' ? (
              <form
                className="employees-form"
                onSubmit={(
                  event,
                ) => {
                  void submitCreate(
                    event,
                  );
                }}
              >
                <div className="employees-form-grid">
                  <label>
                    <span>
                      Nome completo
                    </span>

                    <input
                      type="text"
                      value={
                        form.name
                      }
                      maxLength={120}
                      required
                      autoFocus
                      onChange={(
                        event,
                      ) => {
                        updateForm(
                          'name',
                          event
                            .target
                            .value,
                        );
                      }}
                    />
                  </label>

                  <label>
                    <span>
                      E-mail
                    </span>

                    <input
                      type="email"
                      value={
                        form.email
                      }
                      maxLength={255}
                      required
                      onChange={(
                        event,
                      ) => {
                        updateForm(
                          'email',
                          event
                            .target
                            .value,
                        );
                      }}
                    />
                  </label>

                  <label>
                    <span>
                      Senha inicial
                    </span>

                    <input
                      type="password"
                      value={
                        form
                          .initialPassword
                      }
                      minLength={12}
                      maxLength={200}
                      required
                      autoComplete="new-password"
                      placeholder="Mínimo de 12 caracteres"
                      onChange={(
                        event,
                      ) => {
                        updateForm(
                          'initialPassword',
                          event
                            .target
                            .value,
                        );
                      }}
                    />
                  </label>

                  <label>
                    <span>
                      Comissão inicial
                    </span>

                    <div className="employees-input-suffix">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          form
                            .commissionPercentage
                        }
                        required
                        placeholder="25"
                        onChange={(
                          event,
                        ) => {
                          updateForm(
                            'commissionPercentage',
                            event
                              .target
                              .value,
                          );
                        }}
                      />

                      <strong>
                        %
                      </strong>
                    </div>
                  </label>

                  <label className="employees-form-full">
                    <span>
                      Início da vigência
                    </span>

                    <input
                      type="date"
                      value={
                        form
                          .effectiveFrom
                      }
                      required
                      onChange={(
                        event,
                      ) => {
                        updateForm(
                          'effectiveFrom',
                          event
                            .target
                            .value,
                        );
                      }}
                    />
                  </label>
                </div>

                <div className="employees-form-note">
                  <ShieldCheck
                    size={18}
                  />

                  <span>
                    A comissão será armazenada como uma
                    política histórica. Mudanças futuras
                    não apagarão valores anteriores.
                  </span>
                </div>

                <div className="employees-modal-actions">
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
                    ) : (
                      <Plus
                        size={17}
                      />
                    )}

                    Criar funcionário
                  </button>
                </div>
              </form>
            ) : null}

            {dialog.type ===
            'EDIT' ? (
              <form
                className="employees-form"
                onSubmit={(
                  event,
                ) => {
                  void submitEdit(
                    event,
                  );
                }}
              >
                <div className="employees-form-grid">
                  <label>
                    <span>
                      Nome completo
                    </span>

                    <input
                      type="text"
                      value={
                        form.name
                      }
                      maxLength={120}
                      required
                      autoFocus
                      onChange={(
                        event,
                      ) => {
                        updateForm(
                          'name',
                          event
                            .target
                            .value,
                        );
                      }}
                    />
                  </label>

                  <label>
                    <span>
                      E-mail
                    </span>

                    <input
                      type="email"
                      value={
                        form.email
                      }
                      maxLength={255}
                      required
                      onChange={(
                        event,
                      ) => {
                        updateForm(
                          'email',
                          event
                            .target
                            .value,
                        );
                      }}
                    />
                  </label>
                </div>

                <div className="employees-modal-actions">
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
                    ) : (
                      <Edit3
                        size={17}
                      />
                    )}

                    Salvar alterações
                  </button>
                </div>
              </form>
            ) : null}

            {dialog.type ===
            'COMMISSION' ? (
              <div className="commission-dialog-content">
                <form
                  className="employees-form commission-form"
                  onSubmit={(
                    event,
                  ) => {
                    void submitCommission(
                      event,
                    );
                  }}
                >
                  <div className="employees-form-grid">
                    <label>
                      <span>
                        Novo percentual
                      </span>

                      <div className="employees-input-suffix">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            form
                              .commissionPercentage
                          }
                          placeholder="25"
                          required
                          autoFocus
                          onChange={(
                            event,
                          ) => {
                            updateForm(
                              'commissionPercentage',
                              event
                                .target
                                .value,
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
                        Vigência a partir de
                      </span>

                      <input
                        type="date"
                        value={
                          form
                            .effectiveFrom
                        }
                        required
                        onChange={(
                          event,
                        ) => {
                          updateForm(
                            'effectiveFrom',
                            event
                              .target
                              .value,
                          );
                        }}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="commission-submit-button"
                    disabled={
                      submitting
                    }
                  >
                    {submitting ? (
                      <LoaderCircle
                        size={17}
                        className="spin"
                      />
                    ) : (
                      <BadgePercent
                        size={17}
                      />
                    )}

                    Registrar comissão
                  </button>
                </form>

                <div className="commission-history">
                  <div className="commission-history-heading">
                    <div>
                      <History
                        size={18}
                      />

                      <strong>
                        Histórico de vigências
                      </strong>
                    </div>

                    <button
                      type="button"
                      disabled={
                        commissionLoadingId ===
                        dialog
                          .employee
                          .employeeId
                      }
                      onClick={() => {
                        void loadCommissionHistory(
                          dialog
                            .employee
                            .employeeId,
                        );
                      }}
                    >
                      Atualizar
                    </button>
                  </div>

                  {commissionLoadingId ===
                  dialog.employee.employeeId ? (
                    <div className="commission-history-loading">
                      <LoaderCircle
                        size={20}
                        className="spin"
                      />

                      Carregando histórico...
                    </div>
                  ) : (
                    <div className="commission-history-list">
                      {(commissionHistory[
                        dialog
                          .employee
                          .employeeId
                      ] ?? []).length ===
                      0 ? (
                        <div className="commission-history-empty">
                          Nenhuma política de comissão
                          encontrada.
                        </div>
                      ) : (
                        (commissionHistory[
                          dialog
                            .employee
                            .employeeId
                        ] ?? []).map(
                          (
                            policy,
                          ) => (
                            <article
                              key={
                                policy.id
                              }
                              className={[
                                'commission-history-item',

                                policy
                                  .effectiveUntil ===
                                null
                                  ? 'current'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              <div className="commission-history-value">
                                <BadgePercent
                                  size={18}
                                />

                                <strong>
                                  {formatPercentage(
                                    policy
                                      .percentageBps,
                                  )}
                                </strong>
                              </div>

                              <div className="commission-history-period">
                                <CalendarDays
                                  size={15}
                                />

                                <span>
                                  {formatDate(
                                    policy
                                      .effectiveFrom,
                                  )}
                                  {' — '}
                                  {formatDate(
                                    policy
                                      .effectiveUntil,
                                  )}
                                </span>
                              </div>

                              {policy
                                .effectiveUntil ===
                              null ? (
                                <span className="commission-current-badge">
                                  Atual
                                </span>
                              ) : null}
                            </article>
                          ),
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="employees-modal-actions">
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
                    Fechar
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}