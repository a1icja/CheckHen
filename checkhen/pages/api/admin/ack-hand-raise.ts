import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
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

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ message: 'Unauthorized' });

  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',')
    .map((e) => `${e.trim()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`) || [];
  if (!adminEmails.includes(session.user.email)) return res.status(403).json({ message: 'Forbidden: Admin only' });

  // Parse the request body to extract the user's email
  const { email: userEmail } = req.body;

  // Find the first unacknowledged hand raise for the user
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

  // Update the hand raise to mark it as acknowledged
  await prisma.handRaise.update({
    where: {
      id: dbHandRaise.id,
    },
    data: {
      isAcknowledged: true,
    },
  });

  // Respond with a success message
  res.status(200).json({message: `Acknowledged hand raise request for ${userEmail}`});
}