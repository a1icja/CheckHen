import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const dbCheckInUser = await prisma.user.findFirst({
    where: {
      clerk_id: userId,
    },
  });

  const dbCurrentClass = await prisma.class.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!dbCurrentClass) {
    return res.status(500).json({ message: "No class found" });
  }

  const dbHandRaiseUser = await prisma.handRaise.findFirst({
    where: {
      userId: dbCheckInUser?.id,
      isAcknowledged: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!dbHandRaiseUser) {
    return res.status(500).json({ message: "No hand raise found" });
  }

  res.status(200).json({ message: JSON.stringify(dbHandRaiseUser) });
}
