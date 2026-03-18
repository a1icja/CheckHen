import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

// Define the structure of the response data
type ResponseData = {
  message: string;
};

// API handler function to send a chat message
export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get authenticated session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Parse the message from the request body
  const { message } = req.body;

  // Upsert the user in the database by email
  const dbCheckInUser = await prisma.user.upsert({
    where: { email: session.user.email },
    update: {},
    create: { email: session.user.email, isAdmin: false },
  });

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

  // Find user's check-in to get their anonymous name
  const userCheckIn = dbCurrentClass.checkIns.find((checkIn) => checkIn.userId === dbCheckInUser.id);

  if (!userCheckIn) {
    return res.status(500).json({ message: 'No check in found' });
  }

  // Create a new chat message in the database with anonymous name
  const newMessage = await prisma.chatMessage.create({
    data: {
      message,
      anonymousName: userCheckIn.anonymousName,
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

  // Respond with the created message
  res.status(200).json({ message: JSON.stringify(newMessage) });
}