import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { NextApiRequest, NextApiResponse } from "next";

// Define the structure of the response data
type ResponseData = {
  message: string;
};

// API handler function to fetch the user's check-in status
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

  // Find the user in the database
  const dbCheckInUser = await prisma.user.findFirst({
    where: {
      clerk_id: userId,
    },
  });

  // Fetch the most recent class
  const dbCurrentClass = await prisma.class.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!dbCurrentClass) {
    return res.status(500).json({ message: "No class found" });
  }

  // Check if the user is checked in for the current class
  const dbCheckIn = await prisma.checkIn.findFirst({
    where: {
      userId: dbCheckInUser?.id,
      classId: dbCurrentClass.id,
    },
  });

  if (!dbCheckIn) {
    return res.status(500).json({ message: "No check-in found" });
  }

  // Respond with the check-in details
  res.status(200).json({ message: JSON.stringify(dbCheckIn) });
}
