import { clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next'
 
type ResponseData = {
  message: string
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

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

  const dbCheckInUsers = await prisma.handRaise.findMany({
    where: {
      isRated: false,
      classId: currentClass.id,
    },
    include: {
        user: true,
    }
  });

  const resObject = [];

  const client = await clerkClient();

    for (const entry of dbCheckInUsers) {
        const clerkUser = await client.users.getUser(entry.user.clerk_id);
        resObject.push({
            email: clerkUser.primaryEmailAddress?.emailAddress,
            name: clerkUser.fullName,
            isAck: entry.isAcknowledged
        })
    }

  res.status(200).json({message: JSON.stringify(resObject)});
}