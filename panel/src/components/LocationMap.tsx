import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Session } from "@/types";
import L from "leaflet";

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/marker-icon-2x.png",
  iconUrl: "/marker-icon.png",
  shadowUrl: "/marker-shadow.png",
});

interface LocationData {
  ip: string;
  lat: number;
  lon: number;
  country: string;
}

interface LocationMapProps {
  sessions: Session[];
}

// Create a global cache to persist across component re-renders
const globalLocationCache = new Map<
  string,
  { data: LocationData; timestamp: number }
>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MAX_LOCATIONS = 50; // Maximum number of locations to display on map

export default function LocationMap({ sessions }: LocationMapProps) {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Create a Set of unique IPs to process
        const uniqueIPs = new Set<string>();

        // Only collect up to MAX_LOCATIONS unique IPs
        sessions.forEach((session) => {
          if (
            typeof session.remote_addr === "string" &&
            session.remote_addr.trim() !== "" &&
            uniqueIPs.size < MAX_LOCATIONS
          ) {
            uniqueIPs.add(session.remote_addr);
          }
        });

        console.log(`Processing ${uniqueIPs.size} unique IPs for map`);

        const newLocations: LocationData[] = [];
        let successCount = 0;
        let errorCount = 0;

        // Process IPs in batches
        const batchSize = 20; // Max number of IPs per API call
        const ipArray = Array.from(uniqueIPs);

        for (let i = 0; i < ipArray.length; i += batchSize) {
          const batch = ipArray.slice(i, i + batchSize);

          // First, filter out IPs that are already in the cache
          const uncachedIPs = batch.filter((ip) => {
            const cached = globalLocationCache.get(ip);
            if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
              newLocations.push(cached.data);
              successCount++;
              return false;
            }
            return true;
          });

          if (uncachedIPs.length === 0) {
            continue; // Skip API call if all IPs in this batch are cached
          }

          // Make a batch request to the API
          try {
            const ipQueryString = uncachedIPs.join(",");
            const response = await fetch(
              `/api/geoip?ip=${encodeURIComponent(ipQueryString)}`,
              {
                headers: {
                  "Cache-Control": "max-age=604800",
                },
              }
            );

            if (response.ok) {
              const data = await response.json();

              // Process the batch results
              for (const ip of uncachedIPs) {
                if (data[ip] && data[ip].lat && data[ip].lon) {
                  const locationData = {
                    ip: ip,
                    lat: data[ip].lat,
                    lon: data[ip].lon,
                    country: data[ip].country || "Unknown",
                  };

                  // Store in global cache
                  globalLocationCache.set(ip, {
                    data: locationData,
                    timestamp: Date.now(),
                  });

                  newLocations.push(locationData);
                  successCount++;
                } else {
                  errorCount++;
                }
              }
            } else {
              errorCount += uncachedIPs.length;
              console.error(
                `Failed to fetch locations for batch: ${uncachedIPs.join(", ")}`
              );
            }
          } catch (error) {
            errorCount += uncachedIPs.length;
            console.error("Error fetching batch location data:", error);
          }

          // Add a small delay between batches
          if (i + batchSize < ipArray.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }

        console.log(
          `Location data: ${successCount} successful, ${errorCount} errors`
        );
        setLocations(newLocations);
      } catch (error) {
        console.error("Error in fetchLocations:", error);
        setError("Failed to load location data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    if (sessions.length > 0) {
      fetchLocations();
    }
  }, [sessions]);

  if (typeof window === "undefined") {
    return null; // Don't render map on server side
  }

  return (
    <div className="bg-[#232A34] p-6 rounded-lg">
      <h3 className="text-white text-lg mb-4">
        Real Time Link Visit Locations{" "}
        {locations.length > 0 && `(${locations.length})`}
      </h3>
      <div className="h-[300px] relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-opacity-50 bg-gray-800 z-10">
            <div className="text-white">Loading map data...</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-opacity-50 bg-gray-800 z-10">
            <div className="text-red-400">{error}</div>
          </div>
        )}
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map((loc, index) => (
            <Marker key={`${loc.ip}-${index}`} position={[loc.lat, loc.lon]}>
              <Popup>
                <div className="text-sm">
                  <div>
                    <strong>IP:</strong> {loc.ip}
                  </div>
                  <div>
                    <strong>Country:</strong> {loc.country}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="mt-2 text-xs text-gray-400">
        {locations.length >= MAX_LOCATIONS &&
          `Showing ${locations.length} locations (maximum). Some locations may not be displayed.`}
      </div>
    </div>
  );
}
