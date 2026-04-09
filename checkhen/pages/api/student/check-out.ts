import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const dbUser = await prisma.user.findFirst({
    where: { email: session.user.email },
  });

  if (!dbUser) {
    return res.status(200).json({ message: 'No user found, nothing to check out' });
  }

  // Find the most recent class
  const currentClass = await prisma.class.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!currentClass) {
    return res.status(200).json({ message: 'No class found, nothing to check out' });
  }

  // Mark the student as not present
  await prisma.checkIn.updateMany({
    where: {
      userId: dbUser.id,
      classId: currentClass.id,
      isPresent: true,
    },
    data: { isPresent: false, checkOutTime: new Date() },
  });

  res.status(200).json({ message: 'Checked out' });
}
