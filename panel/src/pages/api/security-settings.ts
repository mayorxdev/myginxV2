import { NextApiRequest, NextApiResponse } from "next";
import { configService } from "@/services/configService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      const config = await configService.readConfig();
      if (!config) {
        return res.status(200).json({
          blockBots: true,
          redirectUrl: "https://example.com",
        });
      }

      // Add null checks for all nested properties
      const blacklist = config.blacklist || {};
      const general = config.general || {};

      return res.status(200).json({
        blockBots: blacklist.mode === "unauth",
        redirectUrl: general.unauth_url || "https://example.com",
      });
    } else if (req.method === "POST") {
      const { blockBots, redirectUrl } = req.body;

      let success = true;

      // Update blacklist mode if provided
      if (typeof blockBots === "boolean") {
        success = await configService.updateBlacklistMode(blockBots);
      }

      // Update redirect URL if provided
      if (redirectUrl !== undefined) {
        success = await configService.updateRedirectUrl(redirectUrl);
      }

      if (success) {
        return res
          .status(200)
          .json({ message: "Settings updated successfully" });
      } else {
        return res.status(500).json({ error: "Failed to update settings" });
      }
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error handling security settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
