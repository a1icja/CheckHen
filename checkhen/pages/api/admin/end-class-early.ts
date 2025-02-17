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

  const classEnd = new Date(currentClass.createdAt.getTime() + currentClass.duration * 60000);
  if (classEnd < new Date()) {
    return res.status(500).json({ message: "No class found" });
  }

  const newClassDuration = Math.floor(
    (new Date().getTime() - currentClass.createdAt.getTime()) / 60000
  );
  const updatedClass = await prisma.class.update({
    where: {
      id: currentClass.id,
    },
    data: {
      duration: newClassDuration,
    },
  });

  res.status(200).json({ message: JSON.stringify(updatedClass) });
}