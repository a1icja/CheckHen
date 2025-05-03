import type { NextApiRequest, NextApiResponse } from 'next';
import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

type ResponseData = {
  message: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  // Ensure the request method is GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Authenticate the user using Clerk
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Find the user in the database
  const dbCheckInUser = await prisma.user.findFirst({
    where: {
      clerk_id: userId,
    },
  });
  if (!dbCheckInUser) {
    return res.status(500).json({ message: 'No user found' });
  }

  // Fetch the most recent class
  const dbCurrentClass = await prisma.class.findFirst({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      checkIns: true,
    },
  });

  if (!dbCurrentClass) return res.status(500).json({ message: 'No class found' });

  // Check if the class has ended
  const classEnd = new Date(dbCurrentClass.createdAt.getTime() + dbCurrentClass.duration * 60000);
  if (classEnd < new Date()) return res.status(500).json({ message: 'No class found' });

  // Verify if the user is checked in for the class
  if (!dbCurrentClass.checkIns.some((checkIn) => checkIn.userId === dbCheckInUser.id)) {
    return res.status(500).json({ message: 'No check in found' });
  }

  // Fetch the most recent chat message for the class
  const dbMessage = await prisma.chatMessage.findFirst({
    where: {
      classId: dbCurrentClass.id,
    },
    orderBy: {
      createdAt: 'desc',
    }
  });

  if (!dbMessage) return res.status(500).json({ message: 'No messages found' });

  // Find the user who sent the message
  const user = await prisma.user.findFirst({
    where: {
      id: dbMessage?.userId
    },
  });

  if (!user) return res.status(500).json({ message: 'No users found' });

  // Fetch user details from Clerk
  const client = await clerkClient();
  const clerkUsers = await client.users.getUserList({
    userId: [user.clerk_id]
  });

  const clerkUser = clerkUsers.data.find((clerkUser) => clerkUser.id === user.clerk_id);

  // Construct the response message
  const message = {
    id: dbMessage.id,
    message: dbMessage.message,
    clerkId: clerkUser?.id,
    userName: clerkUser?.firstName || 'Unknown',
  };

  // Respond with the message
  res.status(200).json({ message: JSON.stringify([message]) });
}
