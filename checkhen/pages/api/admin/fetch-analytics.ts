import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type StudentSummary = {
  email: string;
  anonymousName: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  durationMinutes: number | null;
  handRaiseCount: number;
  paceSignal: string | null;
  engagementScore: number | null;
};

type AnalyticsResponse = {
  students: StudentSummary[];
  paceAggregate: { slow_down: number; ready_to_move_on: number };
  classes: { id: string; name: string; createdAt: string; duration: number }[];
  selectedClass: { id: string; name: string; createdAt: string; duration: number } | null;
};

type ErrorResponse = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyticsResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ message: 'Unauthorized' });

  const adminEmails = process.env.ADMIN_EMAILS?.split(',')
    .map((e) => `${e.trim()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`) || [];
  if (!adminEmails.includes(session.user.email)) {
    return res.status(403).json({ message: 'Forbidden: Admin only' });
  }

  // Fetch all classes for the selector (most recent first)
  const allClasses = await prisma.class.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const classesSerialized = allClasses.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
    duration: c.duration,
  }));

  // Select the requested class or fall back to most recent
  const { classId } = req.query;
  const targetClass = classId
    ? allClasses.find((c) => c.id === classId)
    : allClasses[0];

  if (!targetClass) {
    return res.status(200).json({
      students: [],
      paceAggregate: { slow_down: 0, ready_to_move_on: 0 },
      classes: classesSerialized,
      selectedClass: null,
    });
  }

  // Fetch all check-ins for the class (excluding admins)
  const checkIns = await prisma.checkIn.findMany({
    where: {
      classId: targetClass.id,
      user: { email: { notIn: adminEmails } },
    },
    include: { user: true },
  });

  // Fetch hand raises for the class
  const handRaises = await prisma.handRaise.findMany({
    where: { classId: targetClass.id },
  });

  const handRaiseCounts: Record<string, number> = {};
  for (const hr of handRaises) {
    handRaiseCounts[hr.userId] = (handRaiseCounts[hr.userId] ?? 0) + 1;
  }

  // Fetch most recent pace signal per student for this class
  const paceSignals = await prisma.paceSignal.findMany({
    where: { classId: targetClass.id },
    orderBy: { createdAt: 'desc' },
  });

  const latestPaceSignal: Record<string, string> = {};
  for (const ps of paceSignals) {
    if (!latestPaceSignal[ps.userId]) {
      latestPaceSignal[ps.userId] = ps.signalType;
    }
  }

  // Aggregate pace signals for the whole class
  const paceAggregate = { slow_down: 0, ready_to_move_on: 0 };
  for (const signalType of Object.values(latestPaceSignal)) {
    if (signalType === 'slow_down') paceAggregate.slow_down++;
    else if (signalType === 'ready_to_move_on') paceAggregate.ready_to_move_on++;
  }

  // Build per-student summaries
  const students: StudentSummary[] = checkIns.map((checkIn) => {
    const durationMinutes =
      checkIn.checkOutTime
        ? Math.round((checkIn.checkOutTime.getTime() - checkIn.createdAt.getTime()) / 60000)
        : null;

    const handRaiseCount = handRaiseCounts[checkIn.userId] ?? 0;
    const hasPaceSignal = !!latestPaceSignal[checkIn.userId];

    // Engagement score (computed on read, formula adjustable):
    // - Up to 50 pts for time on task
    // - Up to 30 pts for hand raises (capped at 3)
    // - 20 pts for any pace signal
    let engagementScore: number | null = null;
    if (durationMinutes !== null) {
      const timeScore = Math.min(durationMinutes / targetClass.duration, 1) * 50;
      const handScore = Math.min(handRaiseCount, 3) * 10;
      const paceScore = hasPaceSignal ? 20 : 0;
      engagementScore = Math.round(timeScore + handScore + paceScore);
    }

    return {
      email: checkIn.user.email,
      anonymousName: checkIn.anonymousName,
      checkInTime: checkIn.createdAt.toISOString(),
      checkOutTime: checkIn.checkOutTime?.toISOString() ?? null,
      durationMinutes,
      handRaiseCount,
      paceSignal: latestPaceSignal[checkIn.userId] ?? null,
      engagementScore,
    };
  });

  // Sort by engagement score descending (nulls last)
  students.sort((a, b) => {
    if (a.engagementScore === null && b.engagementScore === null) return 0;
    if (a.engagementScore === null) return 1;
    if (b.engagementScore === null) return -1;
    return b.engagementScore - a.engagementScore;
  });

  return res.status(200).json({
    students,
    paceAggregate,
    classes: classesSerialized,
    selectedClass: {
      id: targetClass.id,
      name: targetClass.name,
      createdAt: targetClass.createdAt.toISOString(),
      duration: targetClass.duration,
    },
  });
}
