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

  const { foodAllergies } = req.body as { foodAllergies?: string };

  if (typeof foodAllergies !== 'string' && foodAllergies !== undefined) {
    return res.status(400).json({ message: 'Invalid foodAllergies value' });
  }

  await prisma.user.update({
    where: { email: session.user.email },
    data: { foodAllergies: foodAllergies ?? null },
  });

  return res.status(200).json({ message: 'Profile updated' });
}
