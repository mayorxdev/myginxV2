import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useState } from "react";
import { Session } from "@/types";

interface CountryBarChartProps {
  sessions: Session[];
}

interface CountryStats {
  name: string;
  visits: number;
}

export default function CountryBarChart({ sessions }: CountryBarChartProps) {
  const [countryData, setCountryData] = useState<CountryStats[]>([]);

  useEffect(() => {
    // Create a map to count visits per country
    const countryMap = new Map<string, number>();

    // Process each session
    for (const session of sessions) {
      if (session.geoData?.country) {
        countryMap.set(
          session.geoData.country,
          (countryMap.get(session.geoData.country) || 0) + 1
        );
      }
    }

    // Convert map to array and sort by visits
    const sortedData = Array.from(countryMap.entries())
      .map(([name, visits]) => ({ name, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10); // Top 10 countries

    setCountryData(sortedData);
  }, [sessions]);

  return (
    <div className="bg-[#232A34] p-6 rounded-lg">
      <h3 className="text-white text-lg mb-4">Top Countries by Visits</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={countryData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={60} />
            <Tooltip />
            <Bar dataKey="visits" fill="#4F46E5" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
