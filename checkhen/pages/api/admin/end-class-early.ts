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
  // Ensure the request method is POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Fetch the most recent class
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

  // Check if the class has already ended
  const classEnd = new Date(currentClass.createdAt.getTime() + currentClass.duration * 60000);
  if (classEnd < new Date()) {
    return res.status(500).json({ message: "No class found" });
  }

  // Calculate the new duration based on the current time
  const newClassDuration = Math.floor(
    (new Date().getTime() - currentClass.createdAt.getTime()) / 60000
  );

  // Update the class duration in the database
  const updatedClass = await prisma.class.update({
    where: {
      id: currentClass.id,
    },
    data: {
      duration: newClassDuration,
    },
  });

  // Respond with the updated class details
  res.status(200).json({ message: JSON.stringify(updatedClass) });
}