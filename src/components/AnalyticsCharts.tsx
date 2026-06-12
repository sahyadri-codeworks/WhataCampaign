"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const campaignDelivery = [
  { name: "June Retention", delivery: 94.2 },
  { name: "Welcome Flow", delivery: 97.8 },
  { name: "Re-engage VIP", delivery: 88.4 },
  { name: "Flash Sale", delivery: 72.1 },
  { name: "Feedback Ask", delivery: 96.5 },
  { name: "Onboarding", delivery: 95.3 },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateDailyVolume() {
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(2026, 5, 13);
    date.setDate(date.getDate() - 29 + i);
    const sent = 600 + Math.floor(seededRandom(i + 1) * 400);
    const delivered = sent - Math.floor(seededRandom(i + 100) * 80);
    return {
      date: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      sent,
      delivered,
    };
  });
}

export default function AnalyticsCharts() {
  const dailyVolume = useMemo(() => generateDailyVolume(), []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-foreground mb-4">Delivery Rate by Campaign</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={campaignDelivery} layout="vertical" margin={{ left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v) => [`${v}%`, "Delivery"]}
            />
            <Bar dataKey="delivery" fill="#7c3aed" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-foreground mb-4">Daily Volume (30d rolling)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dailyVolume}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="sent" stroke="#7c3aed" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
