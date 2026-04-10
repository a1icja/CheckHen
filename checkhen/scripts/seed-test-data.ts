/**
 * Seed script: creates a realistic test class session with synthetic students.
 *
 * Usage:
 *   yarn seed [--students=N] [--duration=N] [--profile=active|moderate|quiet]
 *
 * Defaults: 30 students, 75 minutes, moderate profile.
 * Test data is identified by emails ending in @test.example.
 * Run `yarn seed:clean` to remove all test data.
 */

import { PrismaClient } from '@prisma/client';
import { generateUniqueAnonymousName } from '../lib/anonymousNames';
import {
  clamp,
  makeTestEmail,
  MESSAGE_TEMPLATES,
  minutesAfter,
  normalRandom,
  pickRandom,
  randInt,
  TEST_EMAIL_DOMAIN,
} from './seed-helpers';

// ── CLI argument parsing ───────────────────────────────────────────────────

type Profile = 'active' | 'moderate' | 'quiet';

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [key, val] = a.slice(2).split('=');
      return [key, val ?? 'true'];
    }),
);

const NUM_STUDENTS = clamp(parseInt(args.students ?? '30'), 1, 100);
const CLASS_DURATION = clamp(parseInt(args.duration ?? '75'), 10, 180);
const PROFILE: Profile = (['active', 'moderate', 'quiet'].includes(args.profile) ? args.profile : 'moderate') as Profile;

const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
const CLASS_NAME = `[TEST] CS101 — ${today}`;

// Class started 2 hours ago, already ended
const classStart = new Date(Date.now() - 2 * 60 * 60 * 1000);

console.log(`Seeding: ${NUM_STUDENTS} students · ${CLASS_DURATION} min · profile=${PROFILE}`);

// ── Profile configuration ─────────────────────────────────────────────────

const PROFILES: Record<Profile, {
  stayFraction: number;
  earlyFraction: number;
  absentFraction: number;
  // noCheckout: remainder fraction
  slowDownFraction: number;
  signalMeanMin: number;
  signalMeanMax: number;
  msgMean: number;
  msgStdDev: number;
  handRaiseFraction: number;
  ackedFraction: number;
}> = {
  active:   { stayFraction: 0.95, earlyFraction: 0.02, absentFraction: 0.03, slowDownFraction: 0.40, signalMeanMin: 1, signalMeanMax: 4, msgMean: 6,  msgStdDev: 3, handRaiseFraction: 0.50, ackedFraction: 0.70 },
  moderate: { stayFraction: 0.80, earlyFraction: 0.10, absentFraction: 0.05, slowDownFraction: 0.50, signalMeanMin: 0, signalMeanMax: 3, msgMean: 4,  msgStdDev: 4, handRaiseFraction: 0.30, ackedFraction: 0.50 },
  quiet:    { stayFraction: 0.60, earlyFraction: 0.20, absentFraction: 0.15, slowDownFraction: 0.70, signalMeanMin: 1, signalMeanMax: 4, msgMean: 2,  msgStdDev: 2, handRaiseFraction: 0.20, ackedFraction: 0.30 },
};

const cfg = PROFILES[PROFILE];

// ── Cohort assignment ──────────────────────────────────────────────────────

type Cohort = 'stay' | 'early' | 'absent' | 'no-checkout';

function assignCohort(index: number, total: number): Cohort {
  const fraction = index / total;
  if (fraction < cfg.stayFraction) return 'stay';
  if (fraction < cfg.stayFraction + cfg.earlyFraction) return 'early';
  if (fraction < cfg.stayFraction + cfg.earlyFraction + cfg.absentFraction) return 'absent';
  return 'no-checkout';
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  try {
    // 1. Create or find test users
    console.log('Creating users…');
    const userEmails: string[] = [];
    for (let i = 1; i <= NUM_STUDENTS; i++) {
      userEmails.push(makeTestEmail(i));
    }

    await prisma.user.createMany({
      data: userEmails.map((email) => ({ email })),
      skipDuplicates: true,
    });

    const users = await prisma.user.findMany({
      where: { email: { in: userEmails } },
      select: { id: true, email: true },
    });

    // 2. Create class
    console.log('Creating class…');
    const cls = await prisma.class.create({
      data: {
        name: CLASS_NAME,
        duration: CLASS_DURATION,
        createdAt: classStart,
      },
    });

    // 3. Create check-ins (shuffle users for random cohort assignment)
    console.log('Creating check-ins…');
    const shuffled = [...users].sort(() => Math.random() - 0.5);
    const existingNames: string[] = [];

    const checkInData: {
      userId: string;
      classId: string;
      anonymousName: string;
      isPresent: boolean;
      checkOutTime: Date | null;
      createdAt: Date;
    }[] = [];

    for (let i = 0; i < shuffled.length; i++) {
      const user = shuffled[i];
      const cohort = assignCohort(i, shuffled.length);

      // Arrival time
      const arrivalRoll = Math.random();
      let checkInMinutes: number;
      if (arrivalRoll < 0.10) {
        checkInMinutes = randInt(0, 3); // early birds
      } else if (arrivalRoll < 0.85) {
        checkInMinutes = randInt(0, 6); // on time
      } else {
        checkInMinutes = randInt(10, 16); // late
      }

      const checkInTime = minutesAfter(classStart, checkInMinutes);
      const anonymousName = generateUniqueAnonymousName(existingNames);
      existingNames.push(anonymousName);

      let checkOutTime: Date | null = null;
      let isPresent = false;

      if (cohort === 'stay') {
        const checkOutMinutes = randInt(
          Math.max(checkInMinutes + 1, CLASS_DURATION - 5),
          CLASS_DURATION + 1,
        );
        checkOutTime = minutesAfter(classStart, Math.min(checkOutMinutes, CLASS_DURATION));
        isPresent = false;
      } else if (cohort === 'early') {
        const minOut = Math.round(CLASS_DURATION * 0.55);
        const maxOut = Math.round(CLASS_DURATION * 0.80);
        checkOutTime = minutesAfter(classStart, randInt(Math.max(checkInMinutes + 5, minOut), maxOut));
        isPresent = false;
      } else if (cohort === 'absent') {
        const maxOut = Math.round(CLASS_DURATION * 0.49);
        checkOutTime = minutesAfter(classStart, randInt(Math.max(checkInMinutes + 2, 5), Math.max(maxOut, checkInMinutes + 3)));
        isPresent = false;
      } else {
        // no-checkout: still "present"
        checkOutTime = null;
        isPresent = true;
      }

      checkInData.push({
        userId: user.id,
        classId: cls.id,
        anonymousName,
        isPresent,
        checkOutTime,
        createdAt: checkInTime,
      });
    }

    await prisma.checkIn.createMany({ data: checkInData });

    // 4. Create pace signals
    console.log('Creating pace signals…');
    const paceData: { userId: string; classId: string; signalType: string; createdAt: Date }[] = [];

    for (const user of shuffled) {
      const numSignals = randInt(cfg.signalMeanMin, cfg.signalMeanMax + 1);
      for (let s = 0; s < numSignals; s++) {
        let minutesFromStart: number;

        if (PROFILE === 'quiet') {
          // Cluster: 40% at start (0–15 min), 60% at end (last 20 min)
          if (Math.random() < 0.40) {
            minutesFromStart = randInt(1, Math.min(16, CLASS_DURATION));
          } else {
            minutesFromStart = randInt(Math.max(1, CLASS_DURATION - 20), CLASS_DURATION);
          }
        } else {
          minutesFromStart = randInt(2, CLASS_DURATION - 1);
        }

        const signalType = Math.random() < cfg.slowDownFraction ? 'slow_down' : 'ready_to_move_on';
        paceData.push({
          userId: user.id,
          classId: cls.id,
          signalType,
          createdAt: minutesAfter(classStart, minutesFromStart),
        });
      }
    }

    if (paceData.length > 0) {
      await prisma.paceSignal.createMany({ data: paceData });
    }

    // 5. Create chat messages
    console.log('Creating chat messages…');
    const chatData: { userId: string; classId: string; message: string; anonymousName: string; createdAt: Date }[] = [];

    for (let i = 0; i < shuffled.length; i++) {
      const user = shuffled[i];
      const anonName = checkInData[i].anonymousName;
      const numMessages = clamp(Math.round(normalRandom(cfg.msgMean, cfg.msgStdDev)), 0, 20);
      for (let m = 0; m < numMessages; m++) {
        chatData.push({
          userId: user.id,
          classId: cls.id,
          message: pickRandom(MESSAGE_TEMPLATES),
          anonymousName: anonName,
          createdAt: minutesAfter(classStart, randInt(2, CLASS_DURATION - 2)),
        });
      }
    }

    if (chatData.length > 0) {
      await prisma.chatMessage.createMany({ data: chatData });
    }

    // 6. Create hand raises
    console.log('Creating hand raises…');
    const handRaiseData: { userId: string; classId: string; isAcknowledged: boolean; createdAt: Date }[] = [];
    const numRaisers = Math.round(shuffled.length * cfg.handRaiseFraction);

    for (let i = 0; i < numRaisers; i++) {
      const user = shuffled[i];
      const numRaises = randInt(1, 4);
      for (let r = 0; r < numRaises; r++) {
        handRaiseData.push({
          userId: user.id,
          classId: cls.id,
          isAcknowledged: Math.random() < cfg.ackedFraction,
          createdAt: minutesAfter(classStart, randInt(5, CLASS_DURATION - 5)),
        });
      }
    }

    if (handRaiseData.length > 0) {
      await prisma.handRaise.createMany({ data: handRaiseData });
    }

    console.log(`
Done!
  Class ID: ${cls.id}
  Students: ${users.length}
  Pace signals: ${paceData.length}
  Chat messages: ${chatData.length}
  Hand raises: ${handRaiseData.length}

Load the analytics page and select "${CLASS_NAME}" to view the results.
Run \`yarn seed:clean\` to remove this test data.
`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
