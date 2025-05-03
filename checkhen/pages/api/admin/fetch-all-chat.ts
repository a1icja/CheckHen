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

  // Fetch all chat messages for the class
  let dbMessages = await prisma.chatMessage.findMany({
    where: {
      classId: dbCurrentClass.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  dbMessages = dbMessages.reverse();

  // Fetch users who have sent messages
  const userIds = dbMessages.map((message) => message.userId);
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
    },
  });

  // Fetch user details from Clerk
  const client = await clerkClient();
  const clerkUsers = await client.users.getUserList({
    userId: users.map((user) => user.clerk_id),
  });

  // Map database user IDs to Clerk user IDs
  const dbToClerkMap = new Map<string, string>();
  for (const user of users) {
    const clerkUser = clerkUsers.data.find((clerkUser) => clerkUser.id === user.clerk_id);
    if (clerkUser) {
      dbToClerkMap.set(user.id, clerkUser.id);
    }
  }

  // Construct the response messages with user details
  const messages = dbMessages.map((m) => ({
    id: m.id,
    message: m.message,
    clerkId: dbToClerkMap.get(m.userId) || '',
    userName:
      clerkUsers.data.find((clerkUser) => clerkUser.id === dbToClerkMap.get(m.userId))?.firstName ||
      'Unknown',
  }));

  // Respond with the chat messages
  res.status(200).json({ message: JSON.stringify(messages) });
}
