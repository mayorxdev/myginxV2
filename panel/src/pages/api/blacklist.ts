import { NextApiRequest, NextApiResponse } from "next";
import { configService } from "@/services/configService";
import * as fs from "fs";
import * as path from "path";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      try {
        const ips = await configService.readBlacklist();
        return res.status(200).json({ ips });
      } catch (error) {
        console.error("Error reading blacklist:", error);

        // Fallback - try to read the file directly
        try {
          const dataDir = path.join(process.cwd(), "data");
          const blacklistPath = path.join(dataDir, "blacklist.txt");

          if (fs.existsSync(blacklistPath)) {
            const content = fs.readFileSync(blacklistPath, "utf8");
            const ips = content
              .split("\n")
              .filter((line) => line.trim() !== "");
            return res.status(200).json({ ips });
          }

          // If file doesn't exist, return empty array
          return res.status(200).json({ ips: [] });
        } catch (fallbackError) {
          console.error("Fallback error reading blacklist:", fallbackError);
          return res.status(200).json({ ips: [] });
        }
      }
    } else if (req.method === "POST") {
      const { ips } = req.body;
      if (!Array.isArray(ips)) {
        return res.status(400).json({ error: "Invalid input format" });
      }

      try {
        const success = await configService.writeBlacklist(ips);
        if (success) {
          return res
            .status(200)
            .json({ message: "Blacklist updated successfully" });
        } else {
          throw new Error("Failed to update blacklist");
        }
      } catch (writeError) {
        console.error("Error writing blacklist:", writeError);

        // Fallback - try to write the file directly
        try {
          const dataDir = path.join(process.cwd(), "data");
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }

          const blacklistPath = path.join(dataDir, "blacklist.txt");
          fs.writeFileSync(blacklistPath, ips.join("\n"), "utf8");

          return res
            .status(200)
            .json({ message: "Blacklist updated successfully (fallback)" });
        } catch (fallbackError) {
          console.error("Fallback error writing blacklist:", fallbackError);
          return res.status(500).json({ error: "Failed to update blacklist" });
        }
      }
    } else if (req.method === "DELETE") {
      try {
        const success = await configService.writeBlacklist([]);
        if (success) {
          return res
            .status(200)
            .json({ message: "Blacklist cleared successfully" });
        } else {
          throw new Error("Failed to clear blacklist");
        }
      } catch (clearError) {
        console.error("Error clearing blacklist:", clearError);

        // Fallback - try to clear the file directly
        try {
          const dataDir = path.join(process.cwd(), "data");
          const blacklistPath = path.join(dataDir, "blacklist.txt");

          if (fs.existsSync(blacklistPath)) {
            fs.writeFileSync(blacklistPath, "", "utf8");
          }

          return res
            .status(200)
            .json({ message: "Blacklist cleared successfully (fallback)" });
        } catch (fallbackError) {
          console.error("Fallback error clearing blacklist:", fallbackError);
          return res.status(500).json({ error: "Failed to clear blacklist" });
        }
      }
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error handling blacklist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
