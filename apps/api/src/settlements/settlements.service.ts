import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  WeeklySettlementStatus,
} from '@crm/database';

import type {
  AdminCurrentWeekView,
  AdminWeeklySettlementView,
  EmployeeWeeklySettlementView,
  FinancialAdjustmentView,
} from '@crm/contracts';

import type {
  AuthContext,
} from '../auth/auth-context';

import {
  businessDateInTimezone,
  formatBusinessDate,
  parseBusinessDate,
} from '../common/business-date';

import {
  DatabaseService,
} from '../database/database.service';

import type {
  ListSettlementsQueryDto,
} from './dto/list-settlements-query.dto';

/* =========================================================
   INTERNAL TYPES
========================================================= */

interface WeekPeriod {
  start: Date;
  end: Date;
}

interface SettlementTotals {
  approvedRevenue: string;
  bankCost: string;
  adsCost: string;
  employeeAmount: string;
  adminProfit: string;
  openingAdsDebt: string;
  closingAdsDebt: string;
}

@Injectable()
export class SettlementsService {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  /* =======================================================
     CURRENT COMPANY WEEK
  ======================================================= */

  async currentWeek(
    companyId:
      string,
  ): Promise<WeekPeriod> {
    const settings =
      await this.database
        .prisma
        .companySettings
        .findUnique({
          where: {
            companyId,
          },

          select: {
            timezone:
              true,

            weekStartDay:
              true,
          },
        });

    if (!settings) {
      throw new Error(
        'Company settings not found.',
      );
    }

    const businessDate =
      businessDateInTimezone(
        new Date(),
        settings.timezone,
      );

    const today =
      parseBusinessDate(
        businessDate,
      );

    const start =
      new Date(
        today,
      );

    const weekday =
      start.getUTCDay();

    const distance =
      (
        weekday -
        settings.weekStartDay +
        7
      ) % 7;

    start.setUTCDate(
      start.getUTCDate() -
        distance,
    );

    const end =
      new Date(
        start,
      );

    end.setUTCDate(
      end.getUTCDate() +
        6,
    );

    return {
      start,
      end,
    };
  }

  /* =======================================================
     ADMIN — SYNC CURRENT WEEK

     Cria settlements inexistentes.

     OPEN:
       continua sincronizando.

     CLOSED / REVIEW_REQUIRED / PAID:
       nunca são sobrescritos.
  ======================================================= */

  async syncCurrentWeek(
    companyId:
      string,
  ): Promise<AdminCurrentWeekView> {
    const week =
      await this.currentWeek(
        companyId,
      );

    const employees =
      await this.database
        .prisma
        .employee
        .findMany({
          where: {
            user: {
              companyId,

              role:
                'EMPLOYEE',
            },
          },

          select: {
            id:
              true,
          },

          orderBy: {
            createdAt:
              'asc',
          },
        });

    for (
      const employee
      of employees
    ) {
      await this.ensureSettlement(
        companyId,
        employee.id,
        week,
      );
    }

    const settlements =
      await this.listAdmin(
        companyId,
        {
          from:
            formatBusinessDate(
              week.start,
            ),

          to:
            formatBusinessDate(
              week.end,
            ),
        },
      );

    return {
      periodStart:
        formatBusinessDate(
          week.start,
        ),

      periodEnd:
        formatBusinessDate(
          week.end,
        ),

      settlements,
    };
  }

  /* =======================================================
     ADMIN LIST
  ======================================================= */

  async listAdmin(
    companyId:
      string,

    query:
      ListSettlementsQueryDto,
  ): Promise<
    AdminWeeklySettlementView[]
  > {
    const from =
      query.from
        ? parseBusinessDate(
            query.from,
            'from',
          )
        : undefined;

    const to =
      query.to
        ? parseBusinessDate(
            query.to,
            'to',
          )
        : undefined;

    const settlements =
      await this.database
        .prisma
        .weeklySettlement
        .findMany({
          where: {
            companyId,

            ...(query.employeeId
              ? {
                  employeeId:
                    query.employeeId,
                }
              : {}),

            ...(query.status
              ? {
                  status:
                    query.status,
                }
              : {}),

            ...(from || to
              ? {
                  periodStart: {
                    ...(from
                      ? {
                          gte:
                            from,
                        }
                      : {}),

                    ...(to
                      ? {
                          lte:
                            to,
                        }
                      : {}),
                  },
                }
              : {}),
          },

          include: {
            employee: {
              select: {
                id:
                  true,

                user: {
                  select: {
                    name:
                      true,

                    email:
                      true,
                  },
                },
              },
            },
          },

          orderBy: [
            {
              periodStart:
                'desc',
            },

            {
              createdAt:
                'desc',
            },
          ],
        });

    return settlements.map(
      (
        settlement,
      ) =>
        this.toAdminView(
          settlement,
        ),
    );
  }

  /* =======================================================
     EMPLOYEE LIST

     employeeId sempre é derivado da sessão pelo controller.
  ======================================================= */

  async listMy(
    companyId:
      string,

    employeeId:
      string,

    query:
      ListSettlementsQueryDto,
  ): Promise<
    EmployeeWeeklySettlementView[]
  > {
    const from =
      query.from
        ? parseBusinessDate(
            query.from,
            'from',
          )
        : undefined;

    const to =
      query.to
        ? parseBusinessDate(
            query.to,
            'to',
          )
        : undefined;

    const settlements =
      await this.database
        .prisma
        .weeklySettlement
        .findMany({
          where: {
            companyId,

            employeeId,

            ...(query.status
              ? {
                  status:
                    query.status,
                }
              : {}),

            ...(from || to
              ? {
                  periodStart: {
                    ...(from
                      ? {
                          gte:
                            from,
                        }
                      : {}),

                    ...(to
                      ? {
                          lte:
                            to,
                        }
                      : {}),
                  },
                }
              : {}),
          },

          orderBy: {
            periodStart:
              'desc',
          },
        });

    return settlements.map(
      (
        settlement,
      ) =>
        this.toEmployeeView(
          settlement,
        ),
    );
  }

  /* =======================================================
     EMPLOYEE CURRENT WEEK
  ======================================================= */

  async currentMy(
    companyId:
      string,

    employeeId:
      string,
  ): Promise<
    EmployeeWeeklySettlementView
  > {
    await this.assertEmployeeOwnership(
      companyId,
      employeeId,
    );

    const week =
      await this.currentWeek(
        companyId,
      );

    const settlement =
      await this.ensureSettlement(
        companyId,
        employeeId,
        week,
      );

    return this.toEmployeeView(
      settlement,
    );
  }

  /* =======================================================
     CLOSE

     OPEN → CLOSED
  ======================================================= */

  async close(
    auth:
      AuthContext,

    settlementId:
      string,
  ): Promise<
    AdminWeeklySettlementView
  > {
    const existing =
      await this.findAdminSettlement(
        auth.companyId,
        settlementId,
      );

    if (
      existing.status !==
      WeeklySettlementStatus.OPEN
    ) {
      throw new ConflictException(
        'Only OPEN settlements can be closed.',
      );
    }

    const totals =
      await this.aggregatePeriod(
        auth.companyId,
        existing.employeeId,
        {
          start:
            existing.periodStart,

          end:
            existing.periodEnd,
        },
      );

    const now =
      new Date();

    const updated =
      await this.database
        .prisma
        .$transaction(
          async (
            tx,
          ) => {
            const result =
              await tx
                .weeklySettlement
                .update({
                  where: {
                    id:
                      existing.id,
                  },

                  data: {
                    status:
                      WeeklySettlementStatus.CLOSED,

                    approvedRevenue:
                      totals.approvedRevenue,

                    bankCost:
                      totals.bankCost,

                    adsCost:
                      totals.adsCost,

                    employeeAmount:
                      totals.employeeAmount,

                    adminProfit:
                      totals.adminProfit,

                    openingAdsDebt:
                      totals.openingAdsDebt,

                    closingAdsDebt:
                      totals.closingAdsDebt,

                    closedByUserId:
                      auth.userId,

                    closedAt:
                      now,
                  },

                  include: {
                    employee: {
                      select: {
                        id:
                          true,

                        user: {
                          select: {
                            name:
                              true,

                            email:
                              true,
                          },
                        },
                      },
                    },
                  },
                });

            await tx.auditLog
              .create({
                data: {
                  companyId:
                    auth.companyId,

                  actorUserId:
                    auth.userId,

                  action:
                    'settlement.closed',

                  entityType:
                    'WeeklySettlement',

                  entityId:
                    existing.id,

                  before: {
                    status:
                      existing.status,

                    approvedRevenue:
                      existing
                        .approvedRevenue
                        .toFixed(
                          2,
                        ),

                    employeeAmount:
                      existing
                        .employeeAmount
                        .toFixed(
                          2,
                        ),

                    adminProfit:
                      existing
                        .adminProfit
                        .toFixed(
                          2,
                        ),
                  },

                  after: {
                    status:
                      WeeklySettlementStatus.CLOSED,

                    periodStart:
                      formatBusinessDate(
                        existing.periodStart,
                      ),

                    periodEnd:
                      formatBusinessDate(
                        existing.periodEnd,
                      ),

                    approvedRevenue:
                      totals.approvedRevenue,

                    bankCost:
                      totals.bankCost,

                    adsCost:
                      totals.adsCost,

                    employeeAmount:
                      totals.employeeAmount,

                    adminProfit:
                      totals.adminProfit,

                    openingAdsDebt:
                      totals.openingAdsDebt,

                    closingAdsDebt:
                      totals.closingAdsDebt,
                  },
                },
              });

            await tx.outboxEvent
              .create({
                data: {
                  companyId:
                    auth.companyId,

                  eventType:
                    'settlement.closed',

                  aggregateType:
                    'WeeklySettlement',

                  aggregateId:
                    existing.id,

                  payload: {
                    employeeId:
                      existing.employeeId,

                    periodStart:
                      formatBusinessDate(
                        existing.periodStart,
                      ),

                    periodEnd:
                      formatBusinessDate(
                        existing.periodEnd,
                      ),
                  },
                },
              });

            return result;
          },
        );

    return this.toAdminView(
      updated,
    );
  }

  /* =======================================================
     REVIEW

     REVIEW_REQUIRED → CLOSED

     Aceita o estado atualmente materializado.
  ======================================================= */

  async review(
    auth:
      AuthContext,

    settlementId:
      string,
  ): Promise<
    AdminWeeklySettlementView
  > {
    const existing =
      await this.findAdminSettlement(
        auth.companyId,
        settlementId,
      );

    if (
      existing.status !==
      WeeklySettlementStatus.REVIEW_REQUIRED
    ) {
      throw new ConflictException(
        'Only REVIEW_REQUIRED settlements can be reviewed.',
      );
    }

    const totals =
      await this.aggregatePeriod(
        auth.companyId,
        existing.employeeId,
        {
          start:
            existing.periodStart,

          end:
            existing.periodEnd,
        },
      );

    const reviewedAt =
      new Date();

    const updated =
      await this.database
        .prisma
        .$transaction(
          async (
            tx,
          ) => {
            const result =
              await tx
                .weeklySettlement
                .update({
                  where: {
                    id:
                      existing.id,
                  },

                  data: {
                    status:
                      WeeklySettlementStatus.CLOSED,

                    approvedRevenue:
                      totals.approvedRevenue,

                    bankCost:
                      totals.bankCost,

                    adsCost:
                      totals.adsCost,

                    employeeAmount:
                      totals.employeeAmount,

                    adminProfit:
                      totals.adminProfit,

                    openingAdsDebt:
                      totals.openingAdsDebt,

                    closingAdsDebt:
                      totals.closingAdsDebt,

                    closedByUserId:
                      auth.userId,

                    closedAt:
                      reviewedAt,
                  },

                  include: {
                    employee: {
                      select: {
                        id:
                          true,

                        user: {
                          select: {
                            name:
                              true,

                            email:
                              true,
                          },
                        },
                      },
                    },
                  },
                });

            await tx.auditLog
              .create({
                data: {
                  companyId:
                    auth.companyId,

                  actorUserId:
                    auth.userId,

                  action:
                    'settlement.reviewed',

                  entityType:
                    'WeeklySettlement',

                  entityId:
                    existing.id,

                  before: {
                    status:
                      existing.status,

                    approvedRevenue:
                      existing
                        .approvedRevenue
                        .toFixed(
                          2,
                        ),

                    bankCost:
                      existing
                        .bankCost
                        .toFixed(
                          2,
                        ),

                    adsCost:
                      existing
                        .adsCost
                        .toFixed(
                          2,
                        ),

                    employeeAmount:
                      existing
                        .employeeAmount
                        .toFixed(
                          2,
                        ),

                    adminProfit:
                      existing
                        .adminProfit
                        .toFixed(
                          2,
                        ),

                    openingAdsDebt:
                      existing
                        .openingAdsDebt
                        .toFixed(
                          2,
                        ),

                    closingAdsDebt:
                      existing
                        .closingAdsDebt
                        .toFixed(
                          2,
                        ),
                  },

                  after: {
                    status:
                      WeeklySettlementStatus.CLOSED,

                    approvedRevenue:
                      totals.approvedRevenue,

                    bankCost:
                      totals.bankCost,

                    adsCost:
                      totals.adsCost,

                    employeeAmount:
                      totals.employeeAmount,

                    adminProfit:
                      totals.adminProfit,

                    openingAdsDebt:
                      totals.openingAdsDebt,

                    closingAdsDebt:
                      totals.closingAdsDebt,
                  },
                },
              });

            await tx.outboxEvent
              .create({
                data: {
                  companyId:
                    auth.companyId,

                  eventType:
                    'settlement.reviewed',

                  aggregateType:
                    'WeeklySettlement',

                  aggregateId:
                    existing.id,

                  payload: {
                    employeeId:
                      existing.employeeId,

                    periodStart:
                      formatBusinessDate(
                        existing.periodStart,
                      ),

                    periodEnd:
                      formatBusinessDate(
                        existing.periodEnd,
                      ),
                  },
                },
              });

            return result;
          },
        );

    return this.toAdminView(
      updated,
    );
  }

  /* =======================================================
     PAY

     CLOSED → PAID
  ======================================================= */

  async pay(
    auth:
      AuthContext,

    settlementId:
      string,
  ): Promise<
    AdminWeeklySettlementView
  > {
    const existing =
      await this.findAdminSettlement(
        auth.companyId,
        settlementId,
      );

    if (
      existing.status !==
      WeeklySettlementStatus.CLOSED
    ) {
      throw new ConflictException(
        'Only CLOSED settlements can be marked as paid.',
      );
    }

    const now =
      new Date();

    const updated =
      await this.database
        .prisma
        .$transaction(
          async (
            tx,
          ) => {
            const result =
              await tx
                .weeklySettlement
                .update({
                  where: {
                    id:
                      existing.id,
                  },

                  data: {
                    status:
                      WeeklySettlementStatus.PAID,

                    paidByUserId:
                      auth.userId,

                    paidAt:
                      now,
                  },

                  include: {
                    employee: {
                      select: {
                        id:
                          true,

                        user: {
                          select: {
                            name:
                              true,

                            email:
                              true,
                          },
                        },
                      },
                    },
                  },
                });

            await tx.auditLog
              .create({
                data: {
                  companyId:
                    auth.companyId,

                  actorUserId:
                    auth.userId,

                  action:
                    'settlement.paid',

                  entityType:
                    'WeeklySettlement',

                  entityId:
                    existing.id,

                  before: {
                    status:
                      existing.status,

                    employeeAmount:
                      existing
                        .employeeAmount
                        .toFixed(
                          2,
                        ),
                  },

                  after: {
                    status:
                      WeeklySettlementStatus.PAID,

                    employeeAmount:
                      existing
                        .employeeAmount
                        .toFixed(
                          2,
                        ),

                    paidAt:
                      now.toISOString(),
                  },
                },
              });

            await tx.outboxEvent
              .create({
                data: {
                  companyId:
                    auth.companyId,

                  eventType:
                    'settlement.paid',

                  aggregateType:
                    'WeeklySettlement',

                  aggregateId:
                    existing.id,

                  payload: {
                    employeeId:
                      existing.employeeId,

                    periodStart:
                      formatBusinessDate(
                        existing.periodStart,
                      ),

                    periodEnd:
                      formatBusinessDate(
                        existing.periodEnd,
                      ),
                  },
                },
              });

            return result;
          },
        );

    return this.toAdminView(
      updated,
    );
  }

  /* =======================================================
     ADMIN ADJUSTMENTS
  ======================================================= */

  async listAdminAdjustments(
    companyId:
      string,

    settlementId:
      string,
  ): Promise<
    FinancialAdjustmentView[]
  > {
    const settlement =
      await this.database
        .prisma
        .weeklySettlement
        .findFirst({
          where: {
            id:
              settlementId,

            companyId,
          },

          select: {
            id:
              true,
          },
        });

    if (!settlement) {
      throw new NotFoundException(
        'Weekly settlement not found.',
      );
    }

    const adjustments =
      await this.database
        .prisma
        .financialAdjustment
        .findMany({
          where: {
            companyId,

            settlementId,
          },

          orderBy: {
            createdAt:
              'asc',
          },
        });

    return adjustments.map(
      (
        adjustment,
      ) =>
        this.toAdjustmentView(
          adjustment,
        ),
    );
  }

  /* =======================================================
     EMPLOYEE ADJUSTMENTS
  ======================================================= */

  async listMyAdjustments(
    companyId:
      string,

    employeeId:
      string,

    settlementId:
      string,
  ): Promise<
    FinancialAdjustmentView[]
  > {
    const settlement =
      await this.database
        .prisma
        .weeklySettlement
        .findFirst({
          where: {
            id:
              settlementId,

            companyId,

            employeeId,
          },

          select: {
            id:
              true,
          },
        });

    if (!settlement) {
      throw new NotFoundException(
        'Weekly settlement not found.',
      );
    }

    const adjustments =
      await this.database
        .prisma
        .financialAdjustment
        .findMany({
          where: {
            companyId,

            employeeId,

            settlementId,
          },

          orderBy: {
            createdAt:
              'asc',
          },
        });

    return adjustments.map(
      (
        adjustment,
      ) =>
        this.toAdjustmentView(
          adjustment,
        ),
    );
  }

  /* =======================================================
     ENSURE SETTLEMENT

     IMPORTANTE:

     O antigo fluxo era:

       findUnique
       ↓
       create

     Duas requests concorrentes podiam fazer
     findUnique antes da criação e ambas tentavam
     INSERT, provocando P2002.

     Agora usamos createMany + skipDuplicates.

     O UNIQUE do banco continua sendo a garantia final:

       employeeId + periodStart + periodEnd
  ======================================================= */

  private async ensureSettlement(
    companyId:
      string,

    employeeId:
      string,

    period:
      WeekPeriod,
  ) {
    /*
     * Primeiro agregamos o read model financeiro
     * atual da semana.
     *
     * Não executa Financial Engine.
     */
    const totals =
      await this.aggregatePeriod(
        companyId,
        employeeId,
        period,
      );

    /*
     * CREATE RACE-SAFE
     *
     * Se duas requests tentarem criar exatamente
     * a mesma semana:
     *
     * request A → INSERT
     * request B → conflito UNIQUE ignorado
     *
     * em vez de:
     *
     * request B → P2002
     */
    await this.database
      .prisma
      .weeklySettlement
      .createMany({
        data: [
          {
            companyId,

            employeeId,

            periodStart:
              period.start,

            periodEnd:
              period.end,

            status:
              WeeklySettlementStatus.OPEN,

            approvedRevenue:
              totals.approvedRevenue,

            bankCost:
              totals.bankCost,

            adsCost:
              totals.adsCost,

            employeeAmount:
              totals.employeeAmount,

            adminProfit:
              totals.adminProfit,

            openingAdsDebt:
              totals.openingAdsDebt,

            closingAdsDebt:
              totals.closingAdsDebt,
          },
        ],

        skipDuplicates:
          true,
      });

    /*
     * SINCRONIZA SOMENTE OPEN
     *
     * Existe outra possível corrida:
     *
     * sync começa
     * ↓
     * ADMIN fecha settlement
     * ↓
     * sync continua
     *
     * Portanto o UPDATE exige status OPEN.
     *
     * CLOSED, REVIEW_REQUIRED e PAID
     * nunca são sobrescritos por sync.
     */
    await this.database
      .prisma
      .weeklySettlement
      .updateMany({
        where: {
          employeeId,

          periodStart:
            period.start,

          periodEnd:
            period.end,

          status:
            WeeklySettlementStatus.OPEN,
        },

        data: {
          approvedRevenue:
            totals.approvedRevenue,

          bankCost:
            totals.bankCost,

          adsCost:
            totals.adsCost,

          employeeAmount:
            totals.employeeAmount,

          adminProfit:
            totals.adminProfit,

          openingAdsDebt:
            totals.openingAdsDebt,

          closingAdsDebt:
            totals.closingAdsDebt,
        },
      });

    /*
     * Tanto quem criou quanto quem perdeu
     * a corrida carregam o mesmo registro.
     */
    const settlement =
      await this.database
        .prisma
        .weeklySettlement
        .findUnique({
          where: {
            employeeId_periodStart_periodEnd: {
              employeeId,

              periodStart:
                period.start,

              periodEnd:
                period.end,
            },
          },
        });

    if (!settlement) {
      throw new Error(
        'Weekly settlement could not be created or loaded.',
      );
    }

    return settlement;
  }

  /* =======================================================
     AGGREGATE WEEK

     Somente agrega DailyFinancialResult.

     Não executa fórmula financeira novamente.
  ======================================================= */

  private async aggregatePeriod(
    companyId:
      string,

    employeeId:
      string,

    period:
      WeekPeriod,
  ): Promise<
    SettlementTotals
  > {
    const [
      totals,
      first,
      last,
    ] =
      await Promise.all([
        this.database
          .prisma
          .dailyFinancialResult
          .aggregate({
            where: {
              companyId,

              employeeId,

              businessDate: {
                gte:
                  period.start,

                lte:
                  period.end,
              },
            },

            _sum: {
              approvedRevenue:
                true,

              bankCost:
                true,

              adsCost:
                true,

              employeeAmount:
                true,

              adminProfit:
                true,
            },
          }),

        this.database
          .prisma
          .dailyFinancialResult
          .findFirst({
            where: {
              companyId,

              employeeId,

              businessDate: {
                gte:
                  period.start,

                lte:
                  period.end,
              },
            },

            orderBy: {
              businessDate:
                'asc',
            },

            select: {
              openingAdsDebt:
                true,
            },
          }),

        this.database
          .prisma
          .dailyFinancialResult
          .findFirst({
            where: {
              companyId,

              employeeId,

              businessDate: {
                gte:
                  period.start,

                lte:
                  period.end,
              },
            },

            orderBy: {
              businessDate:
                'desc',
            },

            select: {
              closingAdsDebt:
                true,
            },
          }),
      ]);

    return {
      approvedRevenue:
        totals
          ._sum
          .approvedRevenue
          ?.toFixed(
            2,
          ) ??
        '0.00',

      bankCost:
        totals
          ._sum
          .bankCost
          ?.toFixed(
            2,
          ) ??
        '0.00',

      adsCost:
        totals
          ._sum
          .adsCost
          ?.toFixed(
            2,
          ) ??
        '0.00',

      employeeAmount:
        totals
          ._sum
          .employeeAmount
          ?.toFixed(
            2,
          ) ??
        '0.00',

      adminProfit:
        totals
          ._sum
          .adminProfit
          ?.toFixed(
            2,
          ) ??
        '0.00',

      openingAdsDebt:
        first
          ?.openingAdsDebt
          .toFixed(
            2,
          ) ??
        '0.00',

      closingAdsDebt:
        last
          ?.closingAdsDebt
          .toFixed(
            2,
          ) ??
        '0.00',
    };
  }

  /* =======================================================
     OWNERSHIP
  ======================================================= */

  private async assertEmployeeOwnership(
    companyId:
      string,

    employeeId:
      string,
  ): Promise<void> {
    const employee =
      await this.database
        .prisma
        .employee
        .findFirst({
          where: {
            id:
              employeeId,

            user: {
              companyId,

              role:
                'EMPLOYEE',
            },
          },

          select: {
            id:
              true,
          },
        });

    if (!employee) {
      throw new NotFoundException(
        'Employee not found.',
      );
    }
  }

  /* =======================================================
     ADMIN FIND
  ======================================================= */

  private async findAdminSettlement(
    companyId:
      string,

    settlementId:
      string,
  ) {
    const settlement =
      await this.database
        .prisma
        .weeklySettlement
        .findFirst({
          where: {
            id:
              settlementId,

            companyId,
          },
        });

    if (!settlement) {
      throw new NotFoundException(
        'Weekly settlement not found.',
      );
    }

    return settlement;
  }

  /* =======================================================
     ADMIN VIEW
  ======================================================= */

  private toAdminView(
    settlement: {
      id:
        string;

      employeeId:
        string;

      periodStart:
        Date;

      periodEnd:
        Date;

      status:
        WeeklySettlementStatus;

      approvedRevenue: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      bankCost: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      adsCost: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      employeeAmount: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      adminProfit: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      openingAdsDebt: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      closingAdsDebt: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      closedByUserId:
        string |
        null;

      closedAt:
        Date |
        null;

      paidByUserId:
        string |
        null;

      paidAt:
        Date |
        null;

      createdAt:
        Date;

      updatedAt:
        Date;

      employee: {
        id:
          string;

        user: {
          name:
            string;

          email:
            string;
        };
      };
    },
  ): AdminWeeklySettlementView {
    return {
      id:
        settlement.id,

      employee: {
        employeeId:
          settlement
            .employee
            .id,

        name:
          settlement
            .employee
            .user
            .name,

        email:
          settlement
            .employee
            .user
            .email,
      },

      periodStart:
        formatBusinessDate(
          settlement.periodStart,
        ),

      periodEnd:
        formatBusinessDate(
          settlement.periodEnd,
        ),

      status:
        settlement.status,

      approvedRevenue:
        settlement
          .approvedRevenue
          .toFixed(
            2,
          ),

      bankCost:
        settlement
          .bankCost
          .toFixed(
            2,
          ),

      adsCost:
        settlement
          .adsCost
          .toFixed(
            2,
          ),

      employeeAmount:
        settlement
          .employeeAmount
          .toFixed(
            2,
          ),

      adminProfit:
        settlement
          .adminProfit
          .toFixed(
            2,
          ),

      openingAdsDebt:
        settlement
          .openingAdsDebt
          .toFixed(
            2,
          ),

      closingAdsDebt:
        settlement
          .closingAdsDebt
          .toFixed(
            2,
          ),

      closedByUserId:
        settlement
          .closedByUserId,

      closedAt:
        settlement
          .closedAt
          ?.toISOString() ??
        null,

      paidByUserId:
        settlement
          .paidByUserId,

      paidAt:
        settlement
          .paidAt
          ?.toISOString() ??
        null,

      createdAt:
        settlement
          .createdAt
          .toISOString(),

      updatedAt:
        settlement
          .updatedAt
          .toISOString(),
    };
  }

  /* =======================================================
     EMPLOYEE VIEW

     adminProfit nunca é exposto.
  ======================================================= */

  private toEmployeeView(
    settlement: {
      id:
        string;

      periodStart:
        Date;

      periodEnd:
        Date;

      status:
        WeeklySettlementStatus;

      approvedRevenue: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      bankCost: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      adsCost: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      employeeAmount: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      openingAdsDebt: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      closingAdsDebt: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      closedAt:
        Date |
        null;

      paidAt:
        Date |
        null;

      createdAt:
        Date;

      updatedAt:
        Date;
    },
  ): EmployeeWeeklySettlementView {
    return {
      id:
        settlement.id,

      periodStart:
        formatBusinessDate(
          settlement.periodStart,
        ),

      periodEnd:
        formatBusinessDate(
          settlement.periodEnd,
        ),

      status:
        settlement.status,

      approvedRevenue:
        settlement
          .approvedRevenue
          .toFixed(
            2,
          ),

      bankCost:
        settlement
          .bankCost
          .toFixed(
            2,
          ),

      adsCost:
        settlement
          .adsCost
          .toFixed(
            2,
          ),

      employeeAmount:
        settlement
          .employeeAmount
          .toFixed(
            2,
          ),

      openingAdsDebt:
        settlement
          .openingAdsDebt
          .toFixed(
            2,
          ),

      closingAdsDebt:
        settlement
          .closingAdsDebt
          .toFixed(
            2,
          ),

      closedAt:
        settlement
          .closedAt
          ?.toISOString() ??
        null,

      paidAt:
        settlement
          .paidAt
          ?.toISOString() ??
        null,

      createdAt:
        settlement
          .createdAt
          .toISOString(),

      updatedAt:
        settlement
          .updatedAt
          .toISOString(),
    };
  }

  /* =======================================================
     ADJUSTMENT VIEW
  ======================================================= */

  private toAdjustmentView(
    adjustment: {
      id:
        string;

      settlementId:
        string;

      type:
        'CREDIT' |
        'DEBIT';

      amount: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      reason:
        string;

      originType:
        string;

      originId:
        string |
        null;

      createdAt:
        Date;
    },
  ): FinancialAdjustmentView {
    return {
      id:
        adjustment.id,

      settlementId:
        adjustment.settlementId,

      type:
        adjustment.type,

      amount:
        adjustment
          .amount
          .toFixed(
            2,
          ),

      reason:
        adjustment.reason,

      originType:
        adjustment.originType,

      originId:
        adjustment.originId,

      createdAt:
        adjustment
          .createdAt
          .toISOString(),
    };
  }
}