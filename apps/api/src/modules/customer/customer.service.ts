import { hashPassword, verifyPassword } from '@modules/auth/session.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { Document } from '@modules/misc/entities/document.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { DocumentType, UserRole } from '@storage/types';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { ChangePasswordDto } from './dto/change-password.dto';
import { IdentityDocumentDto, UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { AppUser } from './entities/app-user.entity';
import { CustomerProfile as CustomerProfileEntity } from './entities/customer-profile.entity';
import type {
  ChangePasswordResponse,
  CustomerAccount,
  CustomerProfileResponse,
} from './types/customer-profile';
import { toCustomerProfile } from './types/customer-profile';

const IDENTITY_DOCUMENT_NAME = 'Identity document';
const PG_UNIQUE_VIOLATION = '23505';

/** Trims an incoming code and treats an empty string as "clear" (undefined). */
const normalizeCode = (value: string | undefined): string | undefined =>
  value === undefined ? undefined : value.trim() || undefined;

function fieldValidationError(field: string, code: string, message: string): DomainException {
  return new DomainException(
    ErrorCode.VALIDATION_FAILED,
    'Validation failed',
    HttpStatus.BAD_REQUEST,
    {
      fields: [{ field, code, message }],
    },
  );
}

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
    @InjectRepository(CustomerProfileEntity)
    private readonly profiles: Repository<CustomerProfileEntity>,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    private readonly dataSource: DataSource,
  ) {}

  async updateProfile(
    userId: string,
    dto: UpdateCustomerProfileDto,
    actor: AuthUser,
  ): Promise<CustomerProfileResponse> {
    this.assertCanModifyProfile(actor, userId);

    const user = await this.findUserOrFail(userId);
    const existingProfile = await this.profiles.findOne({ where: { userId } });

    await this.validateLocationCodes(dto, existingProfile);

    await this.dataSource.transaction(async (manager) => {
      if (dto.fullName !== undefined || dto.phone !== undefined) {
        if (dto.fullName !== undefined) user.fullName = dto.fullName.trim();
        if (dto.phone !== undefined) user.phone = dto.phone.trim();
        await manager.save(user);
      }

      await this.upsertProfile(manager, userId, dto);
      await this.upsertIdentityDocument(manager, userId, dto.identityDocument);
    });

    return this.loadResponse(userId);
  }

  /**
   * Changes the password of the authenticated customer (identity comes from the
   * session, never from the request body). The current session stays valid — the
   * `sessions` table does not reference the password hash.
   */
  async changePassword(actor: AuthUser, dto: ChangePasswordDto): Promise<ChangePasswordResponse> {
    // `password_hash` is select:false, so it must be requested explicitly.
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: actor.id })
      .getOne();

    if (!user) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const currentPasswordMatches = user.passwordHash
      ? await verifyPassword(dto.currentPassword, user.passwordHash)
      : false;

    if (!currentPasswordMatches) {
      throw fieldValidationError(
        'currentPassword',
        'invalidCredentials',
        'Current password is incorrect',
      );
    }

    if (dto.newPassword === dto.currentPassword) {
      throw fieldValidationError(
        'newPassword',
        'isSameAsCurrent',
        'New password must be different from the current password',
      );
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw fieldValidationError(
        'confirmPassword',
        'notMatch',
        'confirmPassword must match newPassword',
      );
    }

    user.passwordHash = await hashPassword(dto.newPassword);
    await this.users.save(user);

    return { message: 'Password changed successfully' };
  }

  private assertCanModifyProfile(actor: AuthUser, targetUserId: string): void {
    if (actor.id === targetUserId || actor.roles.includes(UserRole.ADMIN)) {
      return;
    }

    throw new DomainException(
      ErrorCode.FORBIDDEN,
      'You can only update your own profile',
      HttpStatus.FORBIDDEN,
    );
  }

  /**
   * Validates province/ward inputs against the `provinces` and `wards` tables by CODE.
   * Names are never used as identifiers. A ward is only accepted when its
   * `province_code` matches the effective province (the incoming code or the stored one).
   */
  private async validateLocationCodes(
    dto: UpdateCustomerProfileDto,
    stored: CustomerProfileEntity | null,
  ): Promise<void> {
    const wardCode = normalizeCode(dto.ward);
    const provinceCode = normalizeCode(dto.province);

    if (provinceCode) {
      const provinces = await this.dataSource.query('SELECT code FROM provinces WHERE code = $1', [
        provinceCode,
      ]);
      if (provinces.length === 0) {
        throw fieldValidationError('province', 'notFound', 'Province code does not exist');
      }
    }

    let wardProvinceCode: string | null = null;
    if (wardCode) {
      const wards = await this.dataSource.query(
        'SELECT province_code AS "provinceCode" FROM wards WHERE code = $1',
        [wardCode],
      );
      if (wards.length === 0) {
        throw fieldValidationError('ward', 'notFound', 'Ward code does not exist');
      }
      wardProvinceCode = wards[0].provinceCode;
    }

    const effectiveProvince = provinceCode ?? stored?.province ?? null;

    if (wardCode) {
      if (!effectiveProvince) {
        throw fieldValidationError(
          'province',
          'isNotEmpty',
          'province is required when ward is set',
        );
      }
      if (wardProvinceCode !== effectiveProvince) {
        throw fieldValidationError(
          'ward',
          'notBelongsToProvince',
          'Ward does not belong to the selected province',
        );
      }
    }

    if (!wardCode && provinceCode && stored?.ward) {
      const wards = await this.dataSource.query(
        'SELECT province_code AS "provinceCode" FROM wards WHERE code = $1',
        [stored.ward],
      );
      if (wards.length > 0 && wards[0].provinceCode !== provinceCode) {
        throw fieldValidationError(
          'ward',
          'notBelongsToProvince',
          'Stored ward does not belong to the selected province',
        );
      }
    }
  }

  private async upsertProfile(
    manager: EntityManager,
    userId: string,
    dto: UpdateCustomerProfileDto,
  ): Promise<void> {
    const addressFields: (keyof UpdateCustomerProfileDto)[] = [
      'addressLine',
      'ward',
      'province',
      'companyName',
      'taxCode',
    ];
    if (addressFields.every((field) => dto[field] === undefined)) {
      return;
    }

    let profile = await manager.findOne(CustomerProfileEntity, { where: { userId } });
    if (!profile) {
      profile = manager.create(CustomerProfileEntity, { userId });
    }

    if (dto.addressLine !== undefined) profile.addressLine = dto.addressLine || undefined;
    if (dto.ward !== undefined) profile.ward = normalizeCode(dto.ward);
    if (dto.province !== undefined) profile.province = normalizeCode(dto.province);
    if (dto.companyName !== undefined) profile.companyName = dto.companyName || undefined;
    if (dto.taxCode !== undefined) profile.taxCode = dto.taxCode || undefined;

    await manager.save(profile);
  }

  private async upsertIdentityDocument(
    manager: EntityManager,
    userId: string,
    dto: IdentityDocumentDto | undefined,
  ): Promise<void> {
    if (!dto || (dto.docNumber === undefined && dto.fileUrl === undefined)) {
      return;
    }

    let document = await manager.findOne(Document, {
      where: { ownerUserId: userId, type: DocumentType.IDENTITY },
    });

    if (!document) {
      if (!dto.fileUrl) {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Validation failed',
          HttpStatus.BAD_REQUEST,
          {
            fields: [
              {
                field: 'identityDocument.fileUrl',
                code: 'isNotEmpty',
                message: 'fileUrl is required for a new identity document',
              },
            ],
          },
        );
      }

      document = manager.create(Document, {
        ownerUserId: userId,
        type: DocumentType.IDENTITY,
        name: IDENTITY_DOCUMENT_NAME,
      });
    }

    if (dto.docNumber !== undefined) document.docNumber = dto.docNumber || undefined;
    if (dto.fileUrl !== undefined) document.fileUrl = dto.fileUrl;

    try {
      await manager.save(document);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Identity document number already exists',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  private async loadResponse(userId: string): Promise<CustomerProfileResponse> {
    const user = await this.findUserOrFail(userId);
    const profile = await this.profiles.findOne({ where: { userId } });
    const identityDocument = await this.documents.findOne({
      where: { ownerUserId: userId, type: DocumentType.IDENTITY },
    });

    return {
      profile: profile ? toCustomerProfile(profile) : null,
      user: this.toCustomerAccount(user),
      identityDocument: identityDocument
        ? { docNumber: identityDocument.docNumber ?? null, fileUrl: identityDocument.fileUrl }
        : null,
    };
  }

  private toCustomerAccount(user: AppUser): CustomerAccount {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? null,
      status: user.status,
    };
  }

  private async findUserOrFail(id: string): Promise<AppUser> {
    const user = await this.users.findOne({ where: { id } });

    if (!user) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = (error as QueryFailedError & { driverError?: { code?: string } }).driverError;
  return driverError?.code === PG_UNIQUE_VIOLATION;
}
