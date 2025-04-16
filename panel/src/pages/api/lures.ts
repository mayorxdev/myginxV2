import { NextApiRequest, NextApiResponse } from "next";
import { configService } from "@/services/configService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get all lures from the config service
    const lures = await configService.getAllLures();

    // Return the lures array
    return res.status(200).json({ lures });
  } catch (error) {
    console.error("Error fetching lures:", error);
    return res.status(500).json({ error: "Failed to fetch lures" });
  }
}
