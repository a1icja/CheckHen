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

  res.status(200).json({message: JSON.stringify(currentClass)});
}