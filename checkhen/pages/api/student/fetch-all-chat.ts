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

  let dbMessages = await prisma.chatMessage.findMany({
    where: {
      classId: dbCurrentClass.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 25,
  });

  // Reverse the order of messages to show the latest messages at the bottom
  dbMessages = dbMessages.reverse();

  // Fetch users who have sent messages
  const userIds = dbMessages.map((message) => message.userId);
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
    },
  });
  
  const client = await clerkClient();
  const clerkUsers = await client.users.getUserList({
    userId: users.map((user) => user.clerk_id)
  });


  const dbToClerkMap = new Map<string, string>();
  for (const user of users) {
    const clerkUser = clerkUsers.data.find((clerkUser) => clerkUser.id === user.clerk_id);
    if (clerkUser) {
      dbToClerkMap.set(user.id, clerkUser.id);
    }
  }

  const messages = dbMessages.map((m) => ({
    id: m.id,
    message: m.message,
    clerkId: dbToClerkMap.get(m.userId) || '',
  }));

  res.status(200).json({ message: JSON.stringify(messages) });
}
