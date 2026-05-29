import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

// Bundles all student mount fetches into one request:
// check-in status, anonymous name, hand raise, pace signals, class info, chat messages
type StartupResponse = {
  isCheckedIn: boolean;
  classId: string | null;
  className: string | null;
  classColor: string | null;
  anonymousName: string | null;
  handRaised: boolean;
  paceSignals: { slowDown: number; readyToMove: number };
  messages: { id: string; message: string; anonymousName: string | null; createdAt: string; userId: string }[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StartupResponse | { message: string }>
) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ message: 'Unauthorized' });

  const email = session.user.email;

  // One query: get user + their recent check-ins
  const dbUser = await prisma.user.findUnique({ where: { email } });
  if (!dbUser) {
    return res.status(200).json({
      isCheckedIn: false, classId: null, className: null, classColor: null,
      anonymousName: null, handRaised: false,
      paceSignals: { slowDown: 0, readyToMove: 0 }, messages: [],
    });
  }

  // Get latest active class
  const currentClass = await prisma.class.findFirst({ orderBy: { createdAt: 'desc' } });
  const classActive = currentClass
    ? new Date(currentClass.createdAt.getTime() + currentClass.duration * 60000) > new Date()
    : false;

  if (!currentClass || !classActive) {
    return res.status(200).json({
      isCheckedIn: false, classId: null, className: null, classColor: null,
      anonymousName: null, handRaised: false,
      paceSignals: { slowDown: 0, readyToMove: 0 }, messages: [],
    });
  }

  // Check-in status
  const checkIn = await prisma.checkIn.findFirst({
    where: { userId: dbUser.id, classId: currentClass.id, isPresent: true },
  });

  if (!checkIn) {
    return res.status(200).json({
      isCheckedIn: false,
      classId: currentClass.id,
      className: currentClass.name,
      classColor: currentClass.color,
      anonymousName: null, handRaised: false,
      paceSignals: { slowDown: 0, readyToMove: 0 }, messages: [],
    });
  }

  // Run remaining queries in parallel
  const fiveMinutesAgo = new Date(Date.now() - 300000);
  const [handRaise, slowDownCount, readyCount, chatMessages] = await Promise.all([
    prisma.handRaise.findFirst({
      where: { userId: dbUser.id, classId: currentClass.id, isAcknowledged: false },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.paceSignal.count({
      where: { classId: currentClass.id, signalType: 'slow_down', createdAt: { gte: fiveMinutesAgo } },
    }),
    prisma.paceSignal.count({
      where: { classId: currentClass.id, signalType: 'ready_to_move_on', createdAt: { gte: fiveMinutesAgo } },
    }),
    prisma.chatMessage.findMany({
      where: { classId: currentClass.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
  ]);

  return res.status(200).json({
    isCheckedIn: true,
    classId: currentClass.id,
    className: currentClass.name,
    classColor: currentClass.color,
    anonymousName: checkIn.anonymousName,
    handRaised: !!handRaise,
    paceSignals: { slowDown: slowDownCount, readyToMove: readyCount },
    messages: chatMessages.map((m) => ({
      id: m.id,
      message: m.message,
      anonymousName: m.anonymousName,
      createdAt: m.createdAt.toISOString(),
      userId: m.userId,
    })),
  });
}
