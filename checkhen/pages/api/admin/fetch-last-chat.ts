import type { NextApiRequest, NextApiResponse } from 'next';
import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

type ResponseData = {
  message: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

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

  const dbMessage = await prisma.chatMessage.findFirst({
    where: {
      classId: dbCurrentClass.id,
    },
    orderBy: {
      createdAt: 'desc',
    }
  });

  if (!dbMessage) return res.status(500).json({ message: 'No messages found' });

  const user = await prisma.user.findFirst({
    where: {
      id: dbMessage?.userId
    },
  });

  if (!user) return res.status(500).json({ message: 'No users found' });
  
  const client = await clerkClient();
  const clerkUsers = await client.users.getUserList({
    userId: [user.clerk_id]
  });


  const clerkUser = clerkUsers.data.find((clerkUser) => clerkUser.id === user.clerk_id);

  const message = {
    id: dbMessage.id,
    message: dbMessage.message,
    clerkId: clerkUser?.id,
    userName: clerkUser?.firstName || 'Unknown',
  };

  res.status(200).json({ message: JSON.stringify([message]) });
}
