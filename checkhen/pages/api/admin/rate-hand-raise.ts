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

  // Parse the request body to extract user email and rating
  const bodyJSON = JSON.parse(req.body);
  const { email: userEmail, good: wasProductive } = bodyJSON;

  // Find the first unacknowledged and unrated hand raise for the user
  const dbHandRaise = await prisma.handRaise.findFirst({
    where: {
      user: {
        email: userEmail,
      },
      isAcknowledged: true,
      isRated: false,
    },
    include: {
        user: true,
    }
  });

  if (!dbHandRaise) {
    return res.status(404).json({ message: "No hand raise request found" });
  }

  // Update the hand raise to mark it as rated and assign the rating
  await prisma.handRaise.update({
    where: {
      id: dbHandRaise.id,
    },
    data: {
      isRated: true,
      hasValue: wasProductive
    },
  });

  // Respond with a success message
  res.status(200).json({message: `Acknowledged hand raise request for ${userEmail}`});
}