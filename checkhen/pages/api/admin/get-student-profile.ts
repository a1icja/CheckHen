import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ message: 'Unauthorized' });

  const adminEmails = process.env.ADMIN_EMAILS?.split(',')
    .map((e) => `${e.trim()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`) || [];
  if (!adminEmails.includes(session.user.email)) {
    return res.status(403).json({ message: 'Forbidden: Admin only' });
  }

  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Missing email parameter' });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      email: true,
      profilePicture: true,
      foodAllergies: true,
      displayName: true,
      namePronunciation: true,
      pronouns: true,
      bio: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.status(200).json({
    email: user.email,
    profilePicture: user.profilePicture ?? null,
    foodAllergies: user.foodAllergies ?? null,
    displayName: user.displayName ?? null,
    namePronunciation: user.namePronunciation ?? null,
    pronouns: user.pronouns ?? null,
    bio: user.bio ?? null,
  });
}
