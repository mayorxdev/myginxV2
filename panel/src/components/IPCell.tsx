import { useState, useEffect } from "react";
import * as flags from "country-flag-icons/react/3x2";
import CopyIcon from "./CopyIcon";

// Client-side cache
const countryCache = new Map<string, { country: string; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface IPCellProps {
  ip: string;
  onCopy: () => void;
}

const CountryFlag = ({ countryCode }: { countryCode: string }) => {
  const Flag = flags[countryCode as keyof typeof flags];
  if (!Flag) return null;
  return <Flag className="w-5 h-4 mr-2" title={countryCode} />;
};

export default function IPCell({ ip, onCopy }: IPCellProps) {
  const [countryCode, setCountryCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchCountry = async () => {
      if (!ip || ip.trim() === "") {
        setCountryCode(null);
        return;
      }

      try {
        // Check client-side cache first
        const cached = countryCache.get(ip);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          setCountryCode(cached.country);
          return;
        }

        const response = await fetch(
          `/api/geoip?ip=${encodeURIComponent(ip)}`,
          {
            headers: {
              "Cache-Control": "max-age=86400",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to lookup IP");
        }
        const data = await response.json();

        // Store in client-side cache
        if (data.country) {
          countryCache.set(ip, {
            country: data.country,
            timestamp: Date.now(),
          });
        }

        setCountryCode(data.country);
      } catch (error) {
        console.error("Error looking up IP:", error);
        setCountryCode(null);
      }
    };

    fetchCountry();
  }, [ip]);

  return (
    <div className="flex items-center">
      {countryCode && <CountryFlag countryCode={countryCode} />}
      <span>{ip || "Unknown"}</span>
      {ip && <CopyIcon text={ip} onClick={onCopy} />}
    </div>
  );
}
