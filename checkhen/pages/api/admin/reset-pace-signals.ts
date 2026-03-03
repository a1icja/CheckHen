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

  // Check if user is admin
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(
    (e) => `${e.trim()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`
  ) || [];

  if (!adminEmails.includes(email)) {
    return res.status(403).json({ message: 'Forbidden: Admin only' });
  }

  // Fetch the most recently created class
  const currentClass = await prisma.class.findFirst({
    orderBy: [{ createdAt: 'desc' }],
  });

  if (!currentClass) {
    return res.status(404).json({ message: 'No class found' });
  }

  // Delete all pace signals for the current class
  await prisma.paceSignal.deleteMany({
    where: {
      classId: currentClass.id,
    },
  });

  res.status(200).json({ message: 'Pace signals reset' });
}
