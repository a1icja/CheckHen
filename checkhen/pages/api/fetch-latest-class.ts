import { clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next'
import { Class } from '@prisma/client';

// Define the structure of the response data
type ResponseData = {
  message: string
  currentClass?: Class
}

// API handler function to fetch the latest active class
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Allow only GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Fetch the most recently created class
  const currentClass = await prisma.class.findFirst({
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
  });

  // Check if a class exists
  if (!currentClass) {
    return res.status(500).json({ message: "No class found" });
  }

  // Calculate the end time of the class
  const classEnd = new Date(currentClass.createdAt.getTime() + currentClass.duration * 60000);
  if (classEnd < new Date()) {
    return res.status(500).json({ message: "No class found" });
  }

  // Respond with the class details
  res.status(200).json({message: JSON.stringify(currentClass)});
}