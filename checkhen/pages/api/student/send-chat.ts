import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

type ResponseData = {
  message: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { message } = JSON.parse(req.body);

  const dbCheckInUser = await prisma.user.findFirst({
    where: {
      clerk_id: userId,
    },
  });

  if (!dbCheckInUser) {
    return res.status(500).json({ message: 'No user found' });
  }

  const dbCurrentClass = await prisma.class.findFirst({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      checkIns: true,
    },
  });

  if (!dbCurrentClass) return res.status(500).json({ message: 'No class found' });
  const classEnd = new Date(dbCurrentClass.createdAt.getTime() + dbCurrentClass.duration * 60000);
  if (classEnd < new Date()) return res.status(500).json({ message: 'No class found' });

  if (!dbCurrentClass.checkIns.some((checkIn) => checkIn.userId === dbCheckInUser.id)) {
    return res.status(500).json({ message: 'No check in found' });
  }

  const newMessage = await prisma.chatMessage.create({
    data: {
      message,
      user: {
        connect: {
          id: dbCheckInUser.id,
        },
      },
      class: {
        connect: {
          id: dbCurrentClass.id,
        },
      },
    },
  });

  res.status(200).json({ message: JSON.stringify(newMessage) });
}