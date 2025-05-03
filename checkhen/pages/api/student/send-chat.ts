import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
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

  // Authenticate the user
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Parse the message from the request body
  const { message } = JSON.parse(req.body);

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

  // Create a new chat message in the database
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

  // Respond with the created message
  res.status(200).json({ message: JSON.stringify(newMessage) });
}