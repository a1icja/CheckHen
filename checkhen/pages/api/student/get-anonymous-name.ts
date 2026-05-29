import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
  anonymousName?: string;
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

  const email = session.user.email;

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
    return res.status(404).json({ message: 'No class found' });
  }

  // Get user's check-in for this class
  const checkIn = await prisma.checkIn.findFirst({
    where: {
      userId: dbUser.id,
      classId: currentClass.id,
    },
  });

  if (!checkIn || !checkIn.anonymousName) {
    return res.status(404).json({ message: 'Not checked in or no anonymous name' });
  }

  res.status(200).json({
    message: 'Anonymous name retrieved',
    anonymousName: checkIn.anonymousName,
  });
}
