import { AppUser } from '@modules/users/entities/app-user.entity';
import { Session } from '@modules/users/entities/session.entity';
import { UserRoleAssignment } from '@modules/users/entities/user-role-assignment.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { UserRole, UserStatus } from '@storage/types';
import { DataSource, Repository } from 'typeorm';
import { AuthCookieService } from './auth.cookie';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './session.util';
import type { AuthUser, SessionContext } from './types/auth-user';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    private readonly dataSource: DataSource,
    private readonly cookies: AuthCookieService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthUser> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.users
      .createQueryBuilder('user')
      .where('lower(user.email) = :email', { email })
      .getOne();

    if (existing) {
      throw new DomainException(
        ErrorCode.EMAIL_ALREADY_REGISTERED,
        'Email is already registered',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await hashPassword(dto.password);

    const user = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(AppUser, {
          email,
          phone: dto.phone.trim(),
          passwordHash,
          fullName: dto.fullName.trim(),
          status: UserStatus.ACTIVE,
        }),
      );

      await manager.save(
        manager.create(UserRoleAssignment, {
          userId: created.id,
          role: UserRole.CUSTOMER,
          startsAt: new Date(),
        }),
      );

      return created;
    });

    return this.toAuthUser(user, [UserRole.CUSTOMER]);
  }

  async login(dto: LoginDto): Promise<AuthUser> {
    const email = dto.email.trim().toLowerCase();

    // `password_hash` is select:false, so it must be requested explicitly.
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('lower(user.email) = :email', { email })
      .getOne();

    if (!user?.passwordHash || user.status !== UserStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordMatches = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new DomainException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.toAuthUser(user, await this.loadRoles(user.id));
  }

  /** Persists a hashed session token and returns the raw token, hash and session identity. */
  async createSession(
    userId: string,
    context: SessionContext,
  ): Promise<{ token: string; sessionTokenHash: string; sessionId: string; expiresAt: Date }> {
    const token = this.cookies.generateToken();
    const sessionTokenHash = this.cookies.hashToken(token);

    const session = this.sessions.create({
      userId,
      sessionTokenHash,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: new Date(Date.now() + this.cookies.ttlMs),
      lastUsedAt: new Date(),
    });
    const saved = await this.sessions.save(session);

    return {
      token,
      sessionTokenHash,
      sessionId: saved.id,
      expiresAt: saved.expiresAt,
    };
  }

  async resolveSession(token: string): Promise<AuthUser | null> {
    const session = await this.sessions.findOne({
      where: { sessionTokenHash: this.cookies.hashToken(token) },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const user = await this.users.findOne({ where: { id: session.userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    await this.sessions.update({ id: session.id }, { lastUsedAt: new Date() });

    return this.toAuthUser(user, await this.loadRoles(user.id));
  }

  async revokeSession(token: string): Promise<void> {
    await this.sessions.update(
      { sessionTokenHash: this.cookies.hashToken(token) },
      { revokedAt: new Date() },
    );
  }

  private async loadRoles(userId: string): Promise<UserRole[]> {
    const assignments = await this.roleAssignments.find({ where: { userId } });
    const now = Date.now();

    return assignments
      .filter(
        (assignment) =>
          assignment.startsAt.getTime() <= now &&
          (!assignment.endsAt || assignment.endsAt.getTime() > now),
      )
      .map((assignment) => assignment.role);
  }

  private toAuthUser(user: AppUser, roles: UserRole[]): AuthUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone ?? null,
      fullName: user.fullName,
      status: user.status,
      roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
