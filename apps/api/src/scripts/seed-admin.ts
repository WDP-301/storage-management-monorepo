/**
 * Bootstraps an administrator account — the only way to get the first ADMIN, since
 * self-registration always yields a CUSTOMER:
 *   SEED_ADMIN_EMAIL=ops@example.com SEED_ADMIN_PASSWORD='...' [SEED_ADMIN_NAME='...'] \
 *     pnpm --filter @storage/api seed:admin
 * Idempotent: creates the user when the email is unknown, otherwise adds a global ADMIN
 * assignment if missing. An existing user's password is never touched, and a suspended or
 * disabled account is refused — it may have been locked because it was compromised.
 */
import { AppUser } from '@entities/app-user.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { hashPassword } from '@modules/auth/session.util';
import { UserRole, UserStatus } from '@storage/types';
import { IsNull } from 'typeorm';
import { AppDataSource } from '../data-source';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readInput(): { email: string; password: string; fullName: string } {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  const fullName = process.env.SEED_ADMIN_NAME?.trim() || 'Administrator';
  if (!EMAIL_PATTERN.test(email)) throw new Error('SEED_ADMIN_EMAIL is missing or invalid');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return { email, password, fullName };
}

async function main(): Promise<void> {
  const { email, password, fullName } = readInput();

  await AppDataSource.initialize();
  try {
    const outcome = await AppDataSource.transaction(async (manager) => {
      let user = await manager
        .getRepository(AppUser)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('lower(user.email) = :email', { email })
        .getOne();

      let created = false;
      if (!user) {
        user = await manager.save(
          manager.create(AppUser, {
            email,
            fullName,
            passwordHash: await hashPassword(password),
            status: UserStatus.ACTIVE,
          }),
        );
        created = true;
      } else if (user.status !== UserStatus.ACTIVE) {
        throw new Error(
          `${email} is ${user.status}; reactivate it deliberately before granting ADMIN`,
        );
      } else if (!user.passwordHash) {
        console.warn(`${email} has no password (OAuth-only) and cannot sign in with one`);
      }

      // (user, role, facility) is unique, so an expired ADMIN row is reopened rather than duplicated.
      const assignment = await manager.findOne(UserRoleAssignment, {
        where: { userId: user.id, role: UserRole.ADMIN, facilityId: IsNull() },
      });
      const alreadyAdmin = !!assignment && isAssignmentActive(assignment);
      if (!assignment) {
        await manager.save(
          manager.create(UserRoleAssignment, {
            userId: user.id,
            role: UserRole.ADMIN,
            startsAt: new Date(),
          }),
        );
      } else if (!alreadyAdmin) {
        await manager.update(UserRoleAssignment, assignment.id, {
          startsAt: new Date(),
          endsAt: null as unknown as Date,
        });
      }

      if (created) return 'created new admin user';
      return alreadyAdmin ? 'already an admin, nothing changed' : 'granted ADMIN to existing user';
    });

    console.log(`seed:admin ${email}: ${outcome}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
