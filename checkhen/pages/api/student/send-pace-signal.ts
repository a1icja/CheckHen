import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
  signalType?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Ensure the request method is POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get authenticated session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const email = session.user.email;
  const { signalType } = JSON.parse(req.body || '{}');

  // Validate signal type
  if (!signalType || !['slow_down', 'ready_to_move_on'].includes(signalType)) {
    return res.status(400).json({ message: 'Invalid signal type' });
  }

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!dbUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Fetch the most recently created class
  const currentClass = await prisma.class.findFirst({
    orderBy: [{ createdAt: 'desc' }],
  });

  if (!currentClass) {
    return res.status(500).json({ message: 'No class found' });
  }

  // Check if user already sent this signal for this class in the last 30 seconds
  const thirtySecondsAgo = new Date(Date.now() - 30000);
  const existingSignal = await prisma.paceSignal.findFirst({
    where: {
      userId: dbUser.id,
      classId: currentClass.id,
      signalType,
      createdAt: {
        gte: thirtySecondsAgo,
      },
    },
  });

  if (existingSignal) {
    return res.status(200).json({
      message: 'Signal already recorded recently',
      signalType
    });
  }

  // Create pace signal
  await prisma.paceSignal.create({
    data: {
      userId: dbUser.id,
      classId: currentClass.id,
      signalType,
    },
  });

  res.status(200).json({
    message: `Pace signal recorded: ${signalType}`,
    signalType
  });
}
