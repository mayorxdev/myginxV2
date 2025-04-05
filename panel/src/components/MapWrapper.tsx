import dynamic from "next/dynamic";
import { Session } from "@/types";

const LocationMapWithNoSSR = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-[#232A34] p-6 rounded-lg">
      <h3 className="text-white text-lg mb-4">Visit Locations</h3>
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-gray-400">Loading map...</div>
      </div>
    </div>
  ),
});

interface MapWrapperProps {
  sessions: Session[];
}

export default function MapWrapper({ sessions }: MapWrapperProps) {
  return <LocationMapWithNoSSR sessions={sessions} />;
}
