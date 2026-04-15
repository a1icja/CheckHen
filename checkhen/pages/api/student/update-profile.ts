import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { foodAllergies, displayName, namePronunciation, pronouns, bio } = req.body as {
    foodAllergies?: string | null;
    displayName?: string | null;
    namePronunciation?: string | null;
    pronouns?: string | null;
    bio?: string | null;
  };

  if (bio && bio.length > 280) {
    return res.status(400).json({ message: 'Bio must be 280 characters or fewer' });
  }

  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      foodAllergies: foodAllergies ?? null,
      displayName: displayName || null,
      namePronunciation: namePronunciation || null,
      pronouns: pronouns || null,
      bio: bio || null,
    },
  });

  return res.status(200).json({ message: 'Profile updated' });
}
