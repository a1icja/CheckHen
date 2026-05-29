import { getServerSession } from 'next-auth';
import { authOptions } from './[...nextauth]';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ isAdmin: boolean }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ isAdmin: false });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(200).json({ isAdmin: false });
  }

  const adminEmails =
    process.env.ADMIN_EMAILS?.split(',').map(
      (e) => `${e.trim()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`
    ) || [];

  return res.status(200).json({ isAdmin: adminEmails.includes(session.user.email) });
}
