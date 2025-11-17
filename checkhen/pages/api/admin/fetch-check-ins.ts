import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

type ResponseData = {
  message: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  // Ensure the request method is GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Fetch the most recent class
  const dbCurrentClass = await prisma.class.findFirst({
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!dbCurrentClass) {
    return res.status(500).json({ message: 'No class found' });
  }

  // Check if the class has ended
  const classEnd = new Date(dbCurrentClass.createdAt.getTime() + dbCurrentClass.duration * 60000);
  if (classEnd < new Date()) {
    return res.status(500).json({ message: 'No class found' });
  }

  // Fetch all check-ins for the current class
  const dbCheckInUsers = await prisma.checkIn.findMany({
    where: {
      classId: dbCurrentClass.id,
    },
    include: {
      user: true,
    },
  });

  // Count hand raises for the current class
  const dbHandRaises = await prisma.handRaise.findMany({
    where: {
      classId: dbCurrentClass.id,
    },
  });

  const handRaiseCounts: Record<string, number> = {};
  for (const handRaise of dbHandRaises) {
    if (handRaiseCounts[handRaise.userId]) {
      handRaiseCounts[handRaise.userId]++;
    } else {
      handRaiseCounts[handRaise.userId] = 1;
    }
  }

  const resObject = [];

  // Construct the response object with user details and hand raise counts
  for (const checkIn of dbCheckInUsers) {
    const user = checkIn.user;
    const username = user.email.split('@')[0]; // Extract username from email
    resObject.push({
      email: user.email,
      name: username,
      handRaiseCount: handRaiseCounts[checkIn.userId] || 0,
    });
  }

  // Respond with the check-in details
  res.status(200).json({ message: JSON.stringify(resObject) });
}
