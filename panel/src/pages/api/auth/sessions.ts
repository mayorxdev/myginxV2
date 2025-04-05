import { NextApiRequest, NextApiResponse } from "next";
import { verifyAuth } from "@/services/auth";
import { Session } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const payload = await verifyAuth(req);
  if (!payload) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Here you would typically fetch sessions from your database
  // For now, we'll return an empty array
  const sessions: Session[] = [];

  return res.status(200).json(sessions);
}
