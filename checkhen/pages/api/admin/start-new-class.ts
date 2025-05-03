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

  // Parse the request body to extract class details
  const { name, duration } = JSON.parse(req.body);

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