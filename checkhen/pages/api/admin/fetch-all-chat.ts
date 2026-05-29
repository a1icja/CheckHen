import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type ResponseData = {
  message: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  // Ensure the request method is GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get authenticated session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(',')
    .map((e) => `${e.trim()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`) || [];
  if (!adminEmails.includes(session.user.email)) return res.status(403).json({ message: 'Forbidden: Admin only' });

  // Find the user in the database by email
  const dbCheckInUser = await prisma.user.findFirst({
    where: {
      email: session.user.email,
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

  // Map database user IDs to user data
  const userMap = new Map<string, typeof users[0]>();
  for (const user of users) {
    userMap.set(user.id, user);
  }

  // Construct the response messages with user details and anonymous names
  const messages = dbMessages.map((m) => {
    const u = userMap.get(m.userId);
    return {
      id: m.id,
      message: m.message,
      anonymousName: m.anonymousName,
      createdAt: m.createdAt,
      userName: u ? u.email.split('@')[0] : 'Unknown',
      user: {
        email: u?.email ?? '',
        displayName: u?.displayName ?? null,
        namePronunciation: u?.namePronunciation ?? null,
        pronouns: u?.pronouns ?? null,
      },
    };
  });

  // Respond with the chat messages
  res.status(200).json({ message: JSON.stringify(messages) });
}
