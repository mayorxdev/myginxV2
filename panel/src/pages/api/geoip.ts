import { NextApiRequest, NextApiResponse } from "next";
import geoip from "geoip-lite";

// Simple in-memory cache with longer retention
const cache = new Map<
  string,
  {
    data: {
      country: string | null;
      lat: number | null;
      lon: number | null;
    };
    timestamp: number;
  }
>();

const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Handle both single IP and multiple IPs (comma-separated)
  const { ip } = req.query;

  if (!ip) {
    return res.status(400).json({ error: "IP address is required" });
  }

  // Check if multiple IPs were requested
  if (typeof ip === "string" && ip.includes(",")) {
    const ips = ip
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);

    // Limit the number of IPs to process at once
    const MAX_IPS = 20;
    const limitedIps = ips.slice(0, MAX_IPS);

    const results: Record<
      string,
      { country: string | null; lat: number | null; lon: number | null }
    > = {};

    for (const singleIp of limitedIps) {
      results[singleIp] = await getGeoIpData(singleIp);
    }

    // Set cache control headers
    res.setHeader("Cache-Control", "public, max-age=604800"); // 7 days
    return res.status(200).json(results);
  } else {
    // Handle single IP
    const singleIp =
      typeof ip === "string" ? ip : Array.isArray(ip) ? ip[0] : "";

    if (!singleIp) {
      return res.status(400).json({ error: "Invalid IP address" });
    }

    const result = await getGeoIpData(singleIp);

    // Set cache control headers
    res.setHeader("Cache-Control", "public, max-age=604800"); // 7 days
    res.setHeader("ETag", `"${singleIp}-${Date.now()}"`);

    return res.status(200).json(result);
  }
}

// Helper function to get geo data for a single IP
async function getGeoIpData(ip: string) {
  // Check cache first
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const geo = geoip.lookup(ip);
    const data = {
      country: geo?.country || null,
      lat: geo?.ll?.[0] || null,
      lon: geo?.ll?.[1] || null,
    };

    // Store in cache
    cache.set(ip, {
      data,
      timestamp: Date.now(),
    });

    return data;
  } catch (error) {
    console.error(`Error looking up IP ${ip}:`, error);
    return {
      country: null,
      lat: null,
      lon: null,
    };
  }
}
