import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

// Define the structure of the response data
type ResponseData = {
  message: string;
};

// API handler function to fetch the last chat message
export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  // Allow only GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get authenticated session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

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

  // Validate the class and check-in status
  if (!dbCurrentClass) return res.status(500).json({ message: 'No class found' });
  const classEnd = new Date(dbCurrentClass.createdAt.getTime() + dbCurrentClass.duration * 60000);
  if (classEnd < new Date()) return res.status(500).json({ message: 'No class found' });

  if (!dbCurrentClass.checkIns.some((checkIn) => checkIn.userId === dbCheckInUser.id)) {
    return res.status(500).json({ message: 'No check in found' });
  }

  // Fetch the last chat message for the class
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

  // Format the message response using email as identifier
  const message = {
    id: dbMessage.id,
    message: dbMessage.message,
  };

  // Respond with the last message
  res.status(200).json({ message: JSON.stringify([message]) });
}
