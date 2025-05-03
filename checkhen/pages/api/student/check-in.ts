import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Ensure the request method is POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Authenticate the user using Clerk
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const client = await clerkClient();

  // Fetch user details from Clerk
  const user = await client.users.getUser(userId);
  if (!user || !user.primaryEmailAddress) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Upsert the user in the database
  const dbUser = await prisma.user.upsert({
    where: { email: user.primaryEmailAddress.emailAddress },
    update: {},
    create: {
      clerk_id: user.id,
      email: user.primaryEmailAddress.emailAddress,
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
    return res.status(200).json({ message: `Already checked in: ${user.primaryEmailAddress.emailAddress}` });
  }

  // Create a new check-in record for the user
  await prisma.checkIn.create({
    data: {
      userId: dbUser.id,
      classId: currentClass.id,
    },
  });

  // Respond with a success message
  res.status(200).json({ message: `Checked in: ${user.primaryEmailAddress.emailAddress}` });
}