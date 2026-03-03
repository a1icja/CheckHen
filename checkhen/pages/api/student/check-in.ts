import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { generateUniqueAnonymousName } from '@/lib/anonymousNames';
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

  // Get existing anonymous names for this class to ensure uniqueness
  const existingCheckIns = await prisma.checkIn.findMany({
    where: {
      classId: currentClass.id,
    },
    select: {
      anonymousName: true,
    },
  });

  const existingNames = existingCheckIns
    .map((c) => c.anonymousName)
    .filter((name): name is string => name !== null);

  // Generate a unique anonymous name
  const anonymousName = generateUniqueAnonymousName(existingNames);

  // Create a new check-in record for the user with anonymous name
  await prisma.checkIn.create({
    data: {
      userId: dbUser.id,
      classId: currentClass.id,
      anonymousName,
    },
  });

  // Respond with a success message
  res.status(200).json({ message: `Checked in: ${email}` });
}