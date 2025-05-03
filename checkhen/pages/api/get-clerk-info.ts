import { clerkClient, getAuth, User } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next'

// Define the structure of the response data
type ResponseData = {
  message: string
  user?: User
}

// API handler function to fetch Clerk user information
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Allow only GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Authenticate the user
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Fetch user details from Clerk
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  // Check if the user exists and has a primary email address
  if (!user || !user.primaryEmailAddress) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Respond with the user information
  res.status(200).json({ message: "Success", user });
}