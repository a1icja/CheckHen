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

type TemplateOption = {
  id: string;
  name: string;
  color: string;
};

type AnalyticsResponse = {
  students: StudentSummary[];
  paceAggregate: { slow_down: number; ready_to_move_on: number };
  classes: { id: string; name: string; createdAt: string; duration: number; color: string | null }[];
  selectedClass: { id: string; name: string; createdAt: string; duration: number; color: string | null } | null;
  // All-time mode extras
  allTime?: boolean;
  template?: TemplateOption | null;
  sessionCount?: number;
  templates?: TemplateOption[];
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

  // Fetch all classes for the selector (most recent first, include color)
  const allClasses = await prisma.class.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const classesSerialized = allClasses.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
    duration: c.duration,
    color: c.color,
  }));

  // Fetch all templates for the "All Sessions" options
  const allTemplates = await prisma.classTemplate.findMany({ orderBy: { name: 'asc' } });
  const templateOptions: TemplateOption[] = allTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));

  const { classId, templateId, allTime } = req.query;

  // ── All-time aggregation mode ──────────────────────────────────────────────
  if (allTime === 'true' && typeof templateId === 'string') {
    const template = allTemplates.find((t) => t.id === templateId);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const templateClasses = await prisma.class.findMany({
      where: { templateId },
      orderBy: { createdAt: 'asc' },
    });

    if (templateClasses.length === 0) {
      return res.status(200).json({
        students: [],
        paceAggregate: { slow_down: 0, ready_to_move_on: 0 },
        classes: classesSerialized,
        selectedClass: null,
        allTime: true,
        template: { id: template.id, name: template.name, color: template.color },
        sessionCount: 0,
        templates: templateOptions,
      });
    }

    const classIds = templateClasses.map((c) => c.id);
    const totalPlannedMinutes = templateClasses.reduce((sum, c) => sum + c.duration, 0);

    const checkIns = await prisma.checkIn.findMany({
      where: { classId: { in: classIds }, user: { email: { notIn: adminEmails } } },
      include: { user: true },
    });

    const handRaises = await prisma.handRaise.findMany({ where: { classId: { in: classIds } } });
    const handRaiseCounts: Record<string, number> = {};
    for (const hr of handRaises) {
      handRaiseCounts[hr.userId] = (handRaiseCounts[hr.userId] ?? 0) + 1;
    }

    const paceSignals = await prisma.paceSignal.findMany({
      where: { classId: { in: classIds } },
      orderBy: { createdAt: 'desc' },
    });
    const latestPaceSignal: Record<string, string> = {};
    for (const ps of paceSignals) {
      if (!latestPaceSignal[ps.userId]) latestPaceSignal[ps.userId] = ps.signalType;
    }

    // Aggregate per student across all sessions
    const studentMap: Record<string, {
      email: string;
      anonymousName: string | null;
      firstCheckIn: string;
      lastCheckOut: string | null;
      totalMinutes: number | null;
      hasIncompleteCheckout: boolean;
    }> = {};

    for (const ci of checkIns) {
      const uid = ci.userId;
      const durationMinutes = ci.checkOutTime
        ? Math.round((ci.checkOutTime.getTime() - ci.createdAt.getTime()) / 60000)
        : null;

      if (!studentMap[uid]) {
        studentMap[uid] = {
          email: ci.user.email,
          anonymousName: ci.anonymousName,
          firstCheckIn: ci.createdAt.toISOString(),
          lastCheckOut: ci.checkOutTime?.toISOString() ?? null,
          totalMinutes: durationMinutes,
          hasIncompleteCheckout: durationMinutes === null,
        };
      } else {
        const s = studentMap[uid];
        if (new Date(ci.createdAt) < new Date(s.firstCheckIn)) {
          s.firstCheckIn = ci.createdAt.toISOString();
        }
        if (ci.checkOutTime) {
          if (!s.lastCheckOut || new Date(ci.checkOutTime) > new Date(s.lastCheckOut)) {
            s.lastCheckOut = ci.checkOutTime.toISOString();
          }
        } else {
          s.hasIncompleteCheckout = true;
        }
        if (durationMinutes !== null && s.totalMinutes !== null) {
          s.totalMinutes += durationMinutes;
        } else if (durationMinutes === null) {
          s.hasIncompleteCheckout = true;
        }
      }
    }

    const paceAggregate = { slow_down: 0, ready_to_move_on: 0 };
    for (const signalType of Object.values(latestPaceSignal)) {
      if (signalType === 'slow_down') paceAggregate.slow_down++;
      else if (signalType === 'ready_to_move_on') paceAggregate.ready_to_move_on++;
    }

    const students: StudentSummary[] = Object.entries(studentMap).map(([uid, s]) => {
      const handRaiseCount = handRaiseCounts[uid] ?? 0;
      const hasPaceSignal = !!latestPaceSignal[uid];
      let engagementScore: number | null = null;

      if (!s.hasIncompleteCheckout && s.totalMinutes !== null) {
        const timeScore = Math.min(s.totalMinutes / totalPlannedMinutes, 1) * 50;
        const handScore = Math.min(handRaiseCount, 3) * 10;
        const paceScore = hasPaceSignal ? 20 : 0;
        engagementScore = Math.round(timeScore + handScore + paceScore);
      }

      return {
        email: s.email,
        anonymousName: s.anonymousName,
        checkInTime: s.firstCheckIn,
        checkOutTime: s.lastCheckOut,
        durationMinutes: s.totalMinutes,
        handRaiseCount,
        paceSignal: latestPaceSignal[uid] ?? null,
        engagementScore,
      };
    });

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
      selectedClass: null,
      allTime: true,
      template: { id: template.id, name: template.name, color: template.color },
      sessionCount: templateClasses.length,
      templates: templateOptions,
    });
  }

  // ── Per-session mode (default) ─────────────────────────────────────────────
  const { classId: _ignored, ...rest } = req.query;
  void rest;

  const targetClass = typeof classId === 'string'
    ? allClasses.find((c) => c.id === classId)
    : allClasses[0];

  if (!targetClass) {
    return res.status(200).json({
      students: [],
      paceAggregate: { slow_down: 0, ready_to_move_on: 0 },
      classes: classesSerialized,
      selectedClass: null,
      templates: templateOptions,
    });
  }

  const checkIns = await prisma.checkIn.findMany({
    where: {
      classId: targetClass.id,
      user: { email: { notIn: adminEmails } },
    },
    include: { user: true },
  });

  const handRaises = await prisma.handRaise.findMany({ where: { classId: targetClass.id } });
  const handRaiseCounts: Record<string, number> = {};
  for (const hr of handRaises) {
    handRaiseCounts[hr.userId] = (handRaiseCounts[hr.userId] ?? 0) + 1;
  }

  const paceSignals = await prisma.paceSignal.findMany({
    where: { classId: targetClass.id },
    orderBy: { createdAt: 'desc' },
  });
  const latestPaceSignal: Record<string, string> = {};
  for (const ps of paceSignals) {
    if (!latestPaceSignal[ps.userId]) latestPaceSignal[ps.userId] = ps.signalType;
  }

  const paceAggregate = { slow_down: 0, ready_to_move_on: 0 };
  for (const signalType of Object.values(latestPaceSignal)) {
    if (signalType === 'slow_down') paceAggregate.slow_down++;
    else if (signalType === 'ready_to_move_on') paceAggregate.ready_to_move_on++;
  }

  const students: StudentSummary[] = checkIns.map((checkIn) => {
    const durationMinutes = checkIn.checkOutTime
      ? Math.round((checkIn.checkOutTime.getTime() - checkIn.createdAt.getTime()) / 60000)
      : null;

    const handRaiseCount = handRaiseCounts[checkIn.userId] ?? 0;
    const hasPaceSignal = !!latestPaceSignal[checkIn.userId];

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
      color: targetClass.color,
    },
    templates: templateOptions,
  });
}
