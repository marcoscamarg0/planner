"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Task } from "@/types";
import { formatDate } from "@/lib/utils";

interface ProgressChartProps {
  tasks: Task[];
}

const STATUS_COLORS: Record<string, string> = {
  todo: "hsl(215, 20%, 55%)",
  in_progress: "hsl(239, 84%, 67%)",
  done: "hsl(152, 69%, 39%)",
  cancelled: "hsl(0, 84%, 60%)",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "A fazer",
  in_progress: "Em progresso",
  done: "Concluído",
  cancelled: "Cancelado",
};

function buildAreaData(tasks: Task[]) {
  if (tasks.length === 0) return [];

  const byDate: Record<string, { total: number; done: number }> = {};
  tasks.forEach((t) => {
    const day = t.created_at.slice(0, 10);
    if (!byDate[day]) byDate[day] = { total: 0, done: 0 };
    byDate[day].total++;
    if (t.status === "done") byDate[day].done++;
  });

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, v]) => ({
      date: formatDate(date),
      Total: v.total,
      Concluídas: v.done,
    }));
}

function buildPieData(tasks: Task[]) {
  const counts: Record<string, number> = {};
  tasks.forEach((t) => {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  });
  return Object.entries(counts).map(([key, value]) => ({
    name: STATUS_LABELS[key] ?? key,
    value,
    color: STATUS_COLORS[key] ?? "#6366f1",
  }));
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 border border-border shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export function ProgressChart({ tasks }: ProgressChartProps) {
  const areaData = buildAreaData(tasks);
  const pieData = buildPieData(tasks);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div
        className="lg:col-span-2 glass rounded-2xl p-5"
        aria-label="Gráfico de evolução de tarefas"
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Evolução das Tarefas
        </h3>
        {areaData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Nenhuma tarefa criada ainda
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(222, 47%, 14%)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="Total"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#colorTotal)"
              />
              <Area
                type="monotone"
                dataKey="Concluídas"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorDone)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div
        className="glass rounded-2xl p-5"
        aria-label="Distribuição de tarefas por status"
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Por Status
        </h3>
        {pieData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Sem dados
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-1.5 mt-2">
              {pieData.map((d) => (
                <li
                  key={d.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: d.color }}
                      aria-hidden="true"
                    />
                    {d.name}
                  </span>
                  <span className="font-medium text-foreground">{d.value}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
