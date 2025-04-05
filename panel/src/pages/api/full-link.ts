import { NextApiRequest, NextApiResponse } from "next";
import { configService } from "@/services/configService";
import * as fs from "fs";
import * as path from "path";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const linkInfo = await configService.getFullLink();
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
        const path = config.lures?.[0]?.path || "";
        const fullUrl = domain ? `https://office.${domain}${path}` : "";

        return res.status(200).json({
          fullUrl,
          domain,
          path: path.replace(/^\/+/, ""), // Remove leading slash for display
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
