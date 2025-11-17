import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Ensure the request method is GET
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Fetch the most recent class
  const currentClass = await prisma.class.findFirst({
    orderBy: [
      {
        createdAt: "desc",
      },
    ]
  });

  if (!currentClass) {
    return res.status(500).json({ message: "No class found" });
  }

  // Check if the class has ended
  const classEnd = new Date(currentClass.createdAt.getTime() + currentClass.duration * 60000);
  if (classEnd < new Date()) {
    return res.status(500).json({ message: "No class found" });
  }

  // Fetch unrated hand raises for the current class
  const dbCheckInUsers = await prisma.handRaise.findMany({
    where: {
      isRated: false,
      classId: currentClass.id,
    },
    include: {
        user: true,
    }
  });

  // Count hand raises for the current class
  const dbHandRaises = await prisma.handRaise.findMany({
    where: {
      classId: currentClass.id,
    },
  });

  // Count overall hand raises for all users
  const overallHandRaises = await prisma.handRaise.findMany();
  const overallHandRaiseCounts: Record<string, number> = {};
  for (const handRaise of overallHandRaises) {
    if (overallHandRaiseCounts[handRaise.userId]) {
      overallHandRaiseCounts[handRaise.userId]++;
    } else {
      overallHandRaiseCounts[handRaise.userId] = 1;
    }
  }

  const handRaiseCounts: Record<string, number> = {};
  for (const handRaise of dbHandRaises) {
    if (handRaiseCounts[handRaise.userId]) {
      handRaiseCounts[handRaise.userId]++;
    } else {
      handRaiseCounts[handRaise.userId] = 1;
    }
  }

  const resObject = [];

  // Construct response using email data
  for (const entry of dbCheckInUsers) {
    const user = entry.user;
    const username = user.email.split('@')[0]; // Extract username from email
    resObject.push({
      email: user.email,
      name: username,
      isAck: entry.isAcknowledged,
      handRaiseCount: handRaiseCounts[entry.userId] || 0,
      overallHandRaiseCount: overallHandRaiseCounts[entry.userId] || 0,
    });
  }

  // Respond with the hand raise details
  res.status(200).json({message: JSON.stringify(resObject)});
}