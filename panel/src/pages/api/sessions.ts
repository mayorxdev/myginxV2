import type { NextApiRequest, NextApiResponse } from "next";
import { dbService } from "@/services/database";
import { verifyAuth } from "@/services/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader("Content-Type", "application/json");

  try {
    // Verify authentication
    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const sessions = await dbService.getSessions();
      if (!Array.isArray(sessions)) {
        throw new Error("Invalid sessions data format");
      }
      return res.status(200).json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      return res.status(500).json({
        message: "Failed to fetch sessions",
        details:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      });
    }
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      message: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
}
