import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

// Define the structure of the response data
type ResponseData = {
  message: string;
  status?: boolean;
  classId?: string;
};

// API handler function to toggle the virtual hand raise (VHR) status
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get authenticated session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const email = session.user.email;

  // Upsert the user in the database using email
  const dbUser = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      isAdmin: false,
    },
  });

  // Check if the user has an active hand raise
  const handRaised = await prisma.handRaise.findFirst({
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
    where: {
      userId: dbUser.id,
      isAcknowledged: false,
    },
  });

  // Fetch the current class
  const currentClass = await prisma.class.findFirst({
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
  });
  if (!currentClass) {
    return res.status(500).json({ message: "No class found" });
  }

  let status;
  if (handRaised) {
    // Delete the hand raise if it exists
    await prisma.handRaise.delete({
      where: {
        id: handRaised.id,
      },
    });

    status = false;
  } else {
    // Create a new hand raise if none exists
    await prisma.handRaise.create({
      data: {
        user: {
          connect: {
            id: dbUser.id,
          },
        },
        class: {
          connect: {
            id: currentClass.id,
          },
        },
      },
    });

    status = true;
  }

  // Respond with the updated status
  res
    .status(200)
    .json({ message: `Hand raised: ${status}`, status, classId: currentClass.id });
}
