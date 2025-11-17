import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Ensure the request method is POST
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

  // Fetch the most recently created class
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

  // Check if the user has already checked in for the current class
  const dbCheckIn = await prisma.checkIn.findFirst({
    where: {
      userId: dbUser.id,
      classId: currentClass.id,
    },
  });

  if (dbCheckIn) {
    return res.status(200).json({ message: `Already checked in: ${email}` });
  }

  // Create a new check-in record for the user
  await prisma.checkIn.create({
    data: {
      userId: dbUser.id,
      classId: currentClass.id,
    },
  });

  // Respond with a success message
  res.status(200).json({ message: `Checked in: ${email}` });
}