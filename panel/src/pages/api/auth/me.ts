import { NextApiRequest, NextApiResponse } from "next";
import { verifyAuth } from "@/services/auth";

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

  return res.status(200).json({
    username: payload.username,
    exp: payload.exp,
  });
}
