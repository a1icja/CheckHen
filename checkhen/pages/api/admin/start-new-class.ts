import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

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

  const adminEmails = process.env.ADMIN_EMAILS?.split(',')
    .map((e) => `${e.trim()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`) || [];
  if (!adminEmails.includes(session.user.email)) return res.status(403).json({ message: 'Forbidden: Admin only' });

  // Parse the request body to extract class details
  const { name, duration } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 200) {
    return res.status(400).json({ message: 'Invalid class name' });
  }
  if (!duration || typeof duration !== 'number' || duration <= 0 || duration > 480) {
    return res.status(400).json({ message: 'Invalid duration (must be 1–480 minutes)' });
  }

  // Create a new class in the database
  const newClass = await prisma.class.create({
    data: {
      name,
      duration,
    },
  });

  // Respond with the newly created class details
  res.status(200).json({message: JSON.stringify(newClass)});
}