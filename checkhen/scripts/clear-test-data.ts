/**
 * Teardown script: removes all test data created by seed-test-data.ts.
 *
 * Identifies test data by:
 *   - Users with emails ending in @test.example
 *   - Classes with names starting with [TEST]
 *
 * Usage: yarn seed:clean
 */

import { PrismaClient } from '@prisma/client';
import { TEST_EMAIL_DOMAIN } from './seed-helpers';

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find all test users
    const testUsers = await prisma.user.findMany({
      where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
      select: { id: true, email: true },
    });

    const testUserIds = testUsers.map((u) => u.id);
    console.log(`Found ${testUserIds.length} test users.`);

    if (testUserIds.length > 0) {
      // Delete in dependency order (no cascade in schema)
      const ps = await prisma.paceSignal.deleteMany({ where: { userId: { in: testUserIds } } });
      const hr = await prisma.handRaise.deleteMany({ where: { userId: { in: testUserIds } } });
      const cm = await prisma.chatMessage.deleteMany({ where: { userId: { in: testUserIds } } });
      const ci = await prisma.checkIn.deleteMany({ where: { userId: { in: testUserIds } } });

      console.log(`Deleted: ${ps.count} pace signals, ${hr.count} hand raises, ${cm.count} messages, ${ci.count} check-ins`);

      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }

    // Delete test classes by name prefix (catches empty ones not covered above)
    const testClasses = await prisma.class.deleteMany({
      where: { name: { startsWith: '[TEST]' } },
    });
    console.log(`Deleted ${testClasses.count} test class(es).`);

    console.log('Done — all test data removed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
