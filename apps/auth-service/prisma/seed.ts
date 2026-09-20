import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import * as path from 'node:path';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';
import { hash as argonHash } from '@node-rs/argon2';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: process.env.AUTH_DATABASE_URL! },
    { schema: 'auth' },
  ),
});

/**
 * One account per role, so every demo and every student test starts from
 * recognisable data. Passwords are deliberately obvious - this is a local
 * development seed and must never be run against production.
 *
 * The ids are pinned rather than left to uuid(). The events seed has to credit
 * the conference to the organiser, and services do not share a database, so a
 * known id is the only thing the two seeds can agree on - ...0002 is what
 * apps/events-service/prisma/seed.ts falls back to. Change one, change both.
 */
const USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@somnog.so',
    password: 'Admin12345',
    firstName: 'Somnog',
    lastName: 'Admin',
    role: UserRole.ADMIN,
    affiliation: 'SomaliREN',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'organizer@somnog.so',
    password: 'Organizer12345',
    firstName: 'Khadija',
    lastName: 'Ahmed',
    role: UserRole.ORGANIZER,
    affiliation: 'SomaliREN',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'speaker@somnog.so',
    password: 'Speaker12345',
    firstName: 'Yusuf',
    lastName: 'Ali',
    role: UserRole.SPEAKER,
    affiliation: 'Hormuud University',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'attendee@somnog.so',
    password: 'Attendee12345',
    firstName: 'Amina',
    lastName: 'Hassan',
    role: UserRole.ATTENDEE,
    affiliation: 'SIMAD University',
  },
];

async function main() {
  console.log('Seeding auth schema...');

  for (const user of USERS) {
    const passwordHash = await argonHash(user.password);

    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role },
      create: {
        id: user.id,
        email: user.email,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        affiliation: user.affiliation,
        country: 'Somalia',
        role: user.role,
        emailVerified: true,
      },
    });

    console.log(`  ${created.role.padEnd(9)} ${created.email}  (${user.password})`);
  }

  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
