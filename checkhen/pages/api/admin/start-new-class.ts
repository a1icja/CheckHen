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
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, duration } = JSON.parse(req.body);

  const newClass = await prisma.class.create({
    data: {
      name,
      duration,
    },
  });

  res.status(200).json({message: JSON.stringify(newClass)});
}