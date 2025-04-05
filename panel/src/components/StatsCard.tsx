import React from "react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
}

export default function StatsCard({ title, value, icon }: StatsCardProps) {
  return (
    <div className="bg-[#232A34] p-6 rounded-lg flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="text-indigo-400 text-xl">{icon}</div>
        <div>
          <h3 className="text-gray-400 text-sm">{title}</h3>
          <p className="text-white text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}
