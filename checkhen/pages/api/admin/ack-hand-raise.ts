import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next'
 
type ResponseData = {
  message: string
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const bodyJSON = JSON.parse(req.body);
  const { email: userEmail } = bodyJSON;

  const dbHandRaise = await prisma.handRaise.findFirst({
    where: {
      user: {
        email: userEmail,
      },
      isAcknowledged: false,
    },
    include: {
        user: true,
    }
  });

  if (!dbHandRaise) {
    return res.status(404).json({ message: "No hand raise request found" });
  }

  await prisma.handRaise.update({
    where: {
      id: dbHandRaise.id,
    },
    data: {
      isAcknowledged: true,
    },
  });

  res.status(200).json({message: `Acknowledged hand raise request for ${userEmail}`});
}