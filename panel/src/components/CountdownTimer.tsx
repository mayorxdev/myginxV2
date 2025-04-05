import { useEffect, useState } from "react";
import { useCountdownStore } from "@/store/useCountdownStore";

export default function CountdownTimer() {
  const { startDate, endDate, setStartDate } = useCountdownStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // If no start date is set, set it to now
    if (!startDate) {
      setStartDate(Date.now());
    }
  }, [startDate, setStartDate]);

  if (!isClient) {
    return <div className="text-gray-400">Loading...</div>;
  }

  const formatDate = (date: number) => {
    return new Date(date).toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
    });
  };

  if (!startDate || !endDate) {
    return <div className="text-gray-400">Loading dates...</div>;
  }

  return (
    <div className="text-gray-400">
      Expiring Date: {formatDate(startDate)} - {formatDate(endDate)}
    </div>
  );
}
