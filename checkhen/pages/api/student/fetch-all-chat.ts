import type { NextApiRequest, NextApiResponse } from 'next';
import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// Define the structure of the response data
type ResponseData = {
  message: string;
};

// API handler function to fetch all chat messages for the current class
export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  // Allow only GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Authenticate the user
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

  // Validate the class and check-in status
  if (!dbCurrentClass) return res.status(500).json({ message: 'No class found' });
  const classEnd = new Date(dbCurrentClass.createdAt.getTime() + dbCurrentClass.duration * 60000);
  if (classEnd < new Date()) return res.status(500).json({ message: 'No class found' });

  if (!dbCurrentClass.checkIns.some((checkIn) => checkIn.userId === dbCheckInUser.id)) {
    return res.status(500).json({ message: 'No check in found' });
  }

  // Fetch the latest 25 chat messages for the class
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

  // Fetch Clerk user details
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

  // Format the messages with Clerk user details
  const messages = dbMessages.map((m) => ({
    id: m.id,
    message: m.message,
    clerkId: dbToClerkMap.get(m.userId) || '',
  }));

  // Respond with the formatted messages
  res.status(200).json({ message: JSON.stringify(messages) });
}
