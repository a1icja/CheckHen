import { clerkClient, getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
  message: string;
  status?: boolean;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const client = await clerkClient();

  const user = await client.users.getUser(userId);
  if (!user || !user.primaryEmailAddress) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const dbUser = await prisma.user.upsert({
    where: { email: user.primaryEmailAddress.emailAddress },
    update: {},
    create: {
      clerk_id: user.id,
      email: user.primaryEmailAddress.emailAddress,
    },
  });

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
    await prisma.handRaise.delete({
      where: {
        id: handRaised.id,
      },
    });

    status = false
  } else {
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

    status = true
  }

  res
    .status(200)
    .json({ message: `Hand raised: ${status}`, status });
}
