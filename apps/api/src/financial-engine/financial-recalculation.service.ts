import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  RecalculationService,
} from '@crm/financial-engine';

import type {
  BusinessDate,
  RecalculationSummary,
} from '@crm/financial-engine';

import {
  PrismaFinancialRecalculationRepository,
} from './financial-recalculation.repository';

@Injectable()
export class FinancialRecalculationService {
  private readonly logger =
    new Logger(
      FinancialRecalculationService.name,
    );

  private readonly engine:
    RecalculationService;

  constructor(
    repository:
      PrismaFinancialRecalculationRepository,
  ) {
    this.engine =
      new RecalculationService(
        repository,
      );
  }

  async recalculateEmployeeFrom(
    employeeId: string,
    startDate: BusinessDate,
  ): Promise<RecalculationSummary> {
    return this.engine
      .recalculateEmployeeFrom(
        employeeId,
        startDate,
      );
  }

  async tryRecalculateEmployeeFrom(
    employeeId: string,
    startDate: BusinessDate,
  ): Promise<boolean> {
    try {
      await this.recalculateEmployeeFrom(
        employeeId,
        startDate,
      );

      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Immediate recalculation failed for employee ${employeeId} from ${startDate}. Outbox event remains pending.`,
        error instanceof Error
          ? error.stack
          : undefined,
      );

      return false;
    }
  }
}