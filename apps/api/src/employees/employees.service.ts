import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  argon2id,
  hash,
} from 'argon2';

import {
  UserRole,
  UserStatus,
} from '@crm/database';

import type {
  AdminEmployeeView,
} from '@crm/contracts';

import {
  DatabaseService,
} from '../database/database.service';

import type {
  AuthContext,
} from '../auth/auth-context';

import {
  parseBusinessDate,
} from '../common/business-date';

import type {
  CreateEmployeeDto,
} from './dto/create-employee.dto';

import type {
  UpdateEmployeeDto,
} from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async list(
    companyId: string,
  ): Promise<AdminEmployeeView[]> {
    const employees =
      await this.database.prisma
        .employee.findMany({
          where: {
            user: {
              companyId,
              role:
                UserRole.EMPLOYEE,
            },
          },

          include: {
            user: true,
          },

          orderBy: {
            createdAt: 'desc',
          },
        });

    return employees.map(
      (employee) =>
        this.toView(employee),
    );
  }

  async get(
    companyId: string,
    employeeId: string,
  ): Promise<AdminEmployeeView> {
    const employee =
      await this.findEmployee(
        companyId,
        employeeId,
      );

    return this.toView(
      employee,
    );
  }

  async create(
    auth: AuthContext,
    dto: CreateEmployeeDto,
  ): Promise<AdminEmployeeView> {
    const email =
      dto.email
        .trim()
        .toLowerCase();

    const existing =
      await this.database.prisma
        .user.findUnique({
          where: {
            companyId_email: {
              companyId:
                auth.companyId,
              email,
            },
          },
        });

    if (existing) {
      throw new ConflictException(
        'A user with this email already exists.',
      );
    }

    const passwordHash =
      await hash(
        dto.initialPassword,
        {
          type: argon2id,
        },
      );

    const effectiveFrom =
      parseBusinessDate(
        dto.commissionEffectiveFrom,
        'commissionEffectiveFrom',
      );

    const employee =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const user =
              await tx.user.create({
                data: {
                  companyId:
                    auth.companyId,

                  name:
                    dto.name.trim(),

                  email,

                  passwordHash,

                  role:
                    UserRole.EMPLOYEE,

                  status:
                    UserStatus.ACTIVE,
                },
              });

            const createdEmployee =
              await tx.employee.create({
                data: {
                  userId:
                    user.id,

                  active:
                    true,
                },

                include: {
                  user: true,
                },
              });

            const commission =
              await tx
                .employeeCommissionPolicy
                .create({
                  data: {
                    employeeId:
                      createdEmployee.id,

                    percentageBps:
                      dto.commissionPercentageBps,

                    effectiveFrom,
                  },
                });

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'employee.created',

                entityType:
                  'Employee',

                entityId:
                  createdEmployee.id,

                after: {
                  employeeId:
                    createdEmployee.id,

                  userId:
                    user.id,

                  name:
                    user.name,

                  email:
                    user.email,

                  commissionPercentageBps:
                    commission.percentageBps,

                  commissionEffectiveFrom:
                    dto.commissionEffectiveFrom,
                },
              },
            });

            await tx.outboxEvent.create({
              data: {
                companyId:
                  auth.companyId,

                eventType:
                  'employee-commission-policy.changed',

                aggregateType:
                  'Employee',

                aggregateId:
                  createdEmployee.id,

                payload: {
                  employeeId:
                    createdEmployee.id,

                  effectiveFrom:
                    dto.commissionEffectiveFrom,
                },
              },
            });

            return createdEmployee;
          },
        );

    return this.toView(
      employee,
    );
  }

  async update(
    auth: AuthContext,
    employeeId: string,
    dto: UpdateEmployeeDto,
  ): Promise<AdminEmployeeView> {
    const existing =
      await this.findEmployee(
        auth.companyId,
        employeeId,
      );

    let email =
      existing.user.email;

    if (dto.email !== undefined) {
      email =
        dto.email
          .trim()
          .toLowerCase();

      const emailOwner =
        await this.database.prisma
          .user.findUnique({
            where: {
              companyId_email: {
                companyId:
                  auth.companyId,

                email,
              },
            },
          });

      if (
        emailOwner &&
        emailOwner.id !==
          existing.user.id
      ) {
        throw new ConflictException(
          'A user with this email already exists.',
        );
      }
    }

    const updated =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const user =
              await tx.user.update({
                where: {
                  id:
                    existing.user.id,
                },

                data: {
                  ...(dto.name !==
                  undefined
                    ? {
                        name:
                          dto.name.trim(),
                      }
                    : {}),

                  ...(dto.email !==
                  undefined
                    ? {
                        email,
                      }
                    : {}),
                },
              });

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'employee.updated',

                entityType:
                  'Employee',

                entityId:
                  existing.id,

                before: {
                  name:
                    existing.user.name,

                  email:
                    existing.user.email,
                },

                after: {
                  name:
                    user.name,

                  email:
                    user.email,
                },
              },
            });

            return tx.employee.findUniqueOrThrow({
              where: {
                id:
                  existing.id,
              },

              include: {
                user: true,
              },
            });
          },
        );

    return this.toView(
      updated,
    );
  }

  async deactivate(
    auth: AuthContext,
    employeeId: string,
  ): Promise<AdminEmployeeView> {
    const existing =
      await this.findEmployee(
        auth.companyId,
        employeeId,
      );

    const updated =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            await tx.user.update({
              where: {
                id:
                  existing.user.id,
              },

              data: {
                status:
                  UserStatus.INACTIVE,
              },
            });

            const employee =
              await tx.employee.update({
                where: {
                  id:
                    existing.id,
                },

                data: {
                  active:
                    false,
                },

                include: {
                  user: true,
                },
              });

            // Desativação também mata
            // todas as sessões existentes.
            await tx.refreshSession
              .updateMany({
                where: {
                  userId:
                    existing.user.id,

                  revokedAt:
                    null,
                },

                data: {
                  revokedAt:
                    new Date(),
                },
              });

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'employee.deactivated',

                entityType:
                  'Employee',

                entityId:
                  employee.id,

                before: {
                  active:
                    existing.active,

                  userStatus:
                    existing.user.status,
                },

                after: {
                  active:
                    false,

                  userStatus:
                    UserStatus.INACTIVE,
                },
              },
            });

            return employee;
          },
        );

    return this.toView(
      updated,
    );
  }

  async activate(
    auth: AuthContext,
    employeeId: string,
  ): Promise<AdminEmployeeView> {
    const existing =
      await this.findEmployee(
        auth.companyId,
        employeeId,
      );

    const updated =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            await tx.user.update({
              where: {
                id:
                  existing.user.id,
              },

              data: {
                status:
                  UserStatus.ACTIVE,
              },
            });

            const employee =
              await tx.employee.update({
                where: {
                  id:
                    existing.id,
                },

                data: {
                  active:
                    true,
                },

                include: {
                  user: true,
                },
              });

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'employee.activated',

                entityType:
                  'Employee',

                entityId:
                  employee.id,

                before: {
                  active:
                    existing.active,

                  userStatus:
                    existing.user.status,
                },

                after: {
                  active:
                    true,

                  userStatus:
                    UserStatus.ACTIVE,
                },
              },
            });

            return employee;
          },
        );

    return this.toView(
      updated,
    );
  }

  private async findEmployee(
    companyId: string,
    employeeId: string,
  ) {
    const employee =
      await this.database.prisma
        .employee.findFirst({
          where: {
            id:
              employeeId,

            user: {
              companyId,

              role:
                UserRole.EMPLOYEE,
            },
          },

          include: {
            user: true,
          },
        });

    if (!employee) {
      throw new NotFoundException(
        'Employee not found.',
      );
    }

    return employee;
  }

  private toView(
    employee: {
      id: string;

      active: boolean;

      createdAt: Date;
      updatedAt: Date;

      user: {
        id: string;

        name: string;
        email: string;

        status:
          UserStatus;
      };
    },
  ): AdminEmployeeView {
    return {
      employeeId:
        employee.id,

      userId:
        employee.user.id,

      name:
        employee.user.name,

      email:
        employee.user.email,

      userStatus:
        employee.user.status,

      active:
        employee.active,

      createdAt:
        employee.createdAt
          .toISOString(),

      updatedAt:
        employee.updatedAt
          .toISOString(),
    };
  }
}