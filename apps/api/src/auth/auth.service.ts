import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  JwtService,
} from '@nestjs/jwt';

import {
  createHash,
  randomBytes,
} from 'node:crypto';

import {
  argon2id,
  hash,
  verify,
} from 'argon2';

import {
  CompanyStatus,
  UserRole,
  UserStatus,
} from '@crm/database';

import type {
  AuthSessionResponse,
  AuthenticatedUserView,
} from '@crm/contracts';

import {
  parseAuthEnv,
} from '@crm/config';

import {
  DatabaseService,
} from '../database/database.service';

import type {
  AuthContext,
} from './auth-context';

import type {
  ChangePasswordDto,
} from './dto/change-password.dto';

import type {
  LoginDto,
} from './dto/login.dto';

interface SessionUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;

  employee:
    | {
        id: string;
        active: boolean;
      }
    | null;
}

export interface AuthBundle {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;

  response:
    AuthSessionResponse;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly jwt:
      JwtService,
  ) {}

  async login(
    dto: LoginDto,
  ): Promise<AuthBundle> {
    const email =
      dto.email
        .trim()
        .toLowerCase();

    const company =
      await this.database.prisma
        .company.findUnique({
          where: {
            slug:
              dto.companySlug.trim(),
          },

          select: {
            id: true,
            status: true,
          },
        });

    if (
      !company ||
      company.status !==
        CompanyStatus.ACTIVE
    ) {
      throw new UnauthorizedException(
        'Invalid credentials.',
      );
    }

    const user =
      await this.database.prisma
        .user.findUnique({
          where: {
            companyId_email: {
              companyId:
                company.id,
              email,
            },
          },

          include: {
            employee: true,
          },
        });

    if (
      !user ||
      user.status !==
        UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException(
        'Invalid credentials.',
      );
    }

    const passwordValid =
      await verify(
        user.passwordHash,
        dto.password,
      );

    if (!passwordValid) {
      throw new UnauthorizedException(
        'Invalid credentials.',
      );
    }

    this.assertUserCanLogin(
      user,
    );

    return this.createSession(
      user,
    );
  }

  async refresh(
    refreshToken: string,
  ): Promise<AuthBundle> {
    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const tokenHash =
      this.hashRefreshToken(
        refreshToken,
      );

    const env =
      parseAuthEnv(
        process.env,
      );

    const newRefreshToken =
      this.generateRefreshToken();

    const newTokenHash =
      this.hashRefreshToken(
        newRefreshToken,
      );

    const newExpiresAt =
      this.getRefreshExpiry(
        env.AUTH_REFRESH_TTL_DAYS,
      );

    const result =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const session =
              await tx
                .refreshSession
                .findUnique({
                  where: {
                    tokenHash,
                  },

                  include: {
                    user: {
                      include: {
                        employee: true,
                        company: true,
                      },
                    },
                  },
                });

            const now =
              new Date();

            if (
              !session ||
              session.revokedAt ||
              session.expiresAt <= now ||
              session.user.status !==
                UserStatus.ACTIVE ||
              session.user.company.status !==
                CompanyStatus.ACTIVE
            ) {
              throw new UnauthorizedException();
            }

            this.assertUserCanLogin(
              session.user,
            );

            const revoked =
              await tx
                .refreshSession
                .updateMany({
                  where: {
                    id:
                      session.id,

                    revokedAt:
                      null,

                    expiresAt: {
                      gt: now,
                    },
                  },

                  data: {
                    revokedAt:
                      now,
                  },
                });

            if (
              revoked.count !== 1
            ) {
              throw new UnauthorizedException();
            }

            const nextSession =
              await tx
                .refreshSession
                .create({
                  data: {
                    userId:
                      session.user.id,

                    tokenHash:
                      newTokenHash,

                    expiresAt:
                      newExpiresAt,
                  },
                });

            return {
              user:
                session.user,

              session:
                nextSession,
            };
          },
        );

    const accessToken =
      await this.signAccessToken(
        result.user,
        result.session.id,
      );

    return {
      accessToken,
      refreshToken:
        newRefreshToken,

      csrfToken:
        this.generateCsrfToken(),

      response:
        this.buildResponse(
          result.user,
        ),
    };
  }

  async logout(
    refreshToken:
      | string
      | undefined,
  ): Promise<void> {
    if (!refreshToken) {
      return;
    }

    await this.database.prisma
      .refreshSession
      .updateMany({
        where: {
          tokenHash:
            this.hashRefreshToken(
              refreshToken,
            ),

          revokedAt:
            null,
        },

        data: {
          revokedAt:
            new Date(),
        },
      });
  }

  async changePassword(
    auth: AuthContext,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user =
      await this.database.prisma
        .user.findUnique({
          where: {
            id: auth.userId,
          },
        });

    if (
      !user ||
      user.status !==
        UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException();
    }

    const currentValid =
      await verify(
        user.passwordHash,
        dto.currentPassword,
      );

    if (!currentValid) {
      throw new UnauthorizedException(
        'Current password is invalid.',
      );
    }

    if (
      await verify(
        user.passwordHash,
        dto.newPassword,
      )
    ) {
      throw new BadRequestException(
        'New password must be different from the current password.',
      );
    }

    const passwordHash =
      await hash(
        dto.newPassword,
        {
          type: argon2id,
        },
      );

    await this.database.prisma
      .$transaction([
        this.database.prisma
          .user.update({
            where: {
              id: user.id,
            },

            data: {
              passwordHash,
            },
          }),

        this.database.prisma
          .refreshSession
          .updateMany({
            where: {
              userId:
                user.id,

              revokedAt:
                null,
            },

            data: {
              revokedAt:
                new Date(),
            },
          }),
      ]);
  }

  private async createSession(
    user: SessionUser,
  ): Promise<AuthBundle> {
    const env =
      parseAuthEnv(
        process.env,
      );

    const refreshToken =
      this.generateRefreshToken();

    const session =
      await this.database.prisma
        .refreshSession
        .create({
          data: {
            userId:
              user.id,

            tokenHash:
              this.hashRefreshToken(
                refreshToken,
              ),

            expiresAt:
              this.getRefreshExpiry(
                env.AUTH_REFRESH_TTL_DAYS,
              ),
          },
        });

    const accessToken =
      await this.signAccessToken(
        user,
        session.id,
      );

    return {
      accessToken,
      refreshToken,

      csrfToken:
        this.generateCsrfToken(),

      response:
        this.buildResponse(
          user,
        ),
    };
  }

  private async signAccessToken(
    user: SessionUser,
    sessionId: string,
  ): Promise<string> {
    const env =
      parseAuthEnv(
        process.env,
      );

    return this.jwt.signAsync(
      {
        sub: user.id,

        sid: sessionId,

        companyId:
          user.companyId,

        role:
          user.role,

        employeeId:
          user.employee?.id ??
          null,
      },

      {
        secret:
          env.JWT_ACCESS_SECRET,

        expiresIn:
          env.JWT_ACCESS_TTL_SECONDS,
      },
    );
  }

  private buildResponse(
    user: SessionUser,
  ): AuthSessionResponse {
    const env =
      parseAuthEnv(
        process.env,
      );

    const view:
      AuthenticatedUserView = {
        id: user.id,

        companyId:
          user.companyId,

        employeeId:
          user.employee?.id ??
          null,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role,
      };

    return {
      user: view,

      expiresInSeconds:
        env.JWT_ACCESS_TTL_SECONDS,
    };
  }

  private assertUserCanLogin(
    user: SessionUser,
  ): void {
    if (
      user.role ===
        UserRole.EMPLOYEE &&
      (
        !user.employee ||
        !user.employee.active
      )
    ) {
      throw new UnauthorizedException(
        'Invalid credentials.',
      );
    }
  }

  private generateRefreshToken():
    string {
    return randomBytes(48)
      .toString('base64url');
  }

  private generateCsrfToken():
    string {
    return randomBytes(32)
      .toString('base64url');
  }

  private hashRefreshToken(
    token: string,
  ): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  private getRefreshExpiry(
    days: number,
  ): Date {
    return new Date(
      Date.now() +
        days *
          24 *
          60 *
          60 *
          1000,
    );
  }
}