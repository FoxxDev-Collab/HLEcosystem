"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type PriceDataPoint = {
  date: string;
  [storeName: string]: number | string;
};

type StoreInfo = {
  name: string;
  color: string;
};

export function PriceChart({
  data,
  stores,
}: {
  data: PriceDataPoint[];
  stores: StoreInfo[];
}) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            width={55}
          />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, undefined]}
            labelStyle={{ fontWeight: 600, fontSize: 12 }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          {stores.map((store) => (
            <Line
              key={store.name}
              type="monotone"
              dataKey={store.name}
              stroke={store.color || "#94a3b8"}
              strokeWidth={2}
              dot={{ r: 3, fill: store.color || "#94a3b8" }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
