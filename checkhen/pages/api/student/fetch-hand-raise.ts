import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

// Define the structure of the response data
type ResponseData = {
  message: string;
};

// API handler function to fetch the user's hand raise status
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
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

  // Fetch the most recent class
  const dbCurrentClass = await prisma.class.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!dbCurrentClass) {
    return res.status(500).json({ message: "No class found" });
  }

  // Check if the user has an active hand raise
  const dbHandRaiseUser = await prisma.handRaise.findFirst({
    where: {
      userId: dbCheckInUser?.id,
      isAcknowledged: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!dbHandRaiseUser) {
    return res.status(500).json({ message: "No hand raise found" });
  }

  // Respond with the hand raise details
  res.status(200).json({ message: JSON.stringify(dbHandRaiseUser) });
}
