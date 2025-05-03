import { clerkClient, getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { NextApiRequest, NextApiResponse } from "next";

// Define the structure of the response data
type ResponseData = {
  message: string;
  status?: boolean;
  classId?: string;
};

// API handler function to toggle the virtual hand raise (VHR) status
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Allow only POST requests
  if (req.method !== "POST") {
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

  // Upsert the user in the database
  const dbUser = await prisma.user.upsert({
    where: { email: user.primaryEmailAddress.emailAddress },
    update: {},
    create: {
      clerk_id: user.id,
      email: user.primaryEmailAddress.emailAddress,
    },
  });

  // Check if the user has an active hand raise
  const handRaised = await prisma.handRaise.findFirst({
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
    where: {
      userId: dbUser.id,
      isAcknowledged: false,
    },
  });

  // Fetch the current class
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

  let status;
  if (handRaised) {
    // Delete the hand raise if it exists
    await prisma.handRaise.delete({
      where: {
        id: handRaised.id,
      },
    });

    status = false;
  } else {
    // Create a new hand raise if none exists
    await prisma.handRaise.create({
      data: {
        user: {
          connect: {
            id: dbUser.id,
          },
        },
        class: {
          connect: {
            id: currentClass.id,
          },
        },
      },
    });

    status = true;
  }

  // Respond with the updated status
  res
    .status(200)
    .json({ message: `Hand raised: ${status}`, status, classId: currentClass.id });
}
