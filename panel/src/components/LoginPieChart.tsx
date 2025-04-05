import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface LoginPieChartProps {
  trueLogin: number;
  failedLogin: number;
}

const COLORS = ["#4F46E5", "#EF4444"]; // Indigo for success, Red for failed

export default function LoginPieChart({
  trueLogin,
  failedLogin,
}: LoginPieChartProps) {
  const data = [
    { name: "Logins", value: trueLogin },
    { name: "Failed Logins", value: failedLogin },
  ];

  const total = trueLogin + failedLogin;
  const successRate = total > 0 ? ((trueLogin / total) * 100).toFixed(1) : "0";

  return (
    <div className="bg-[#232A34] p-6 rounded-lg">
      <h3 className="text-white text-lg mb-4">
        Login Success Rate: {successRate}%
      </h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
