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
        return res.status(200).json({ bot_token: "", chat_id: "" });
      }

      // Add null check for general property
      const general = config.general || {};

      return res.status(200).json({
        bot_token: general.telegram_bot_token || "",
        chat_id: general.telegram_chat_id || "",
      });
    } else if (req.method === "POST") {
      const { bot_token, chat_id } = req.body;

      // Allow empty strings or null values
      const success = await configService.updateTelegramSettings(
        bot_token || "",
        chat_id || ""
      );

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
    console.error("Error handling telegram settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
