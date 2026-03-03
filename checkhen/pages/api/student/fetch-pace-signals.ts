import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
  slowDown?: number;
  readyToMove?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Ensure the request method is GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get authenticated session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Fetch the most recently created class
  const currentClass = await prisma.class.findFirst({
    orderBy: [{ createdAt: 'desc' }],
  });

  if (!currentClass) {
    return res.status(404).json({ message: 'No class found' });
  }

  // Get pace signal counts for last 5 minutes (to show recent feedback)
  const fiveMinutesAgo = new Date(Date.now() - 300000);

  const [slowDownSignals, readyToMoveSignals] = await Promise.all([
    prisma.paceSignal.count({
      where: {
        classId: currentClass.id,
        signalType: 'slow_down',
        createdAt: {
          gte: fiveMinutesAgo,
        },
      },
    }),
    prisma.paceSignal.count({
      where: {
        classId: currentClass.id,
        signalType: 'ready_to_move_on',
        createdAt: {
          gte: fiveMinutesAgo,
        },
      },
    }),
  ]);

  res.status(200).json({
    message: 'Pace signals fetched',
    slowDown: slowDownSignals,
    readyToMove: readyToMoveSignals,
  });
}
