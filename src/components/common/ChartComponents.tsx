import React, { useState } from 'react';

// ==============================================================================
// 1. Gráfico de Comparação Temporal: Receitas vs Despesas (Barras + Linhas SVG)
// ==============================================================================
interface MonthlyBarProps {
  data: { month: string; revenue: number; expenses: number; balance: number }[];
  height?: number;
}

export const MonthlyComparisonChart: React.FC<MonthlyBarProps> = ({ data, height = 220 }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.revenue, d.expenses)),
    10000
  );

  return (
    <div className="w-full space-y-3">
      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-emerald-500" />
          <span className="text-slate-600 dark:text-slate-400 font-medium">Receitas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-rose-500" />
          <span className="text-slate-600 dark:text-slate-400 font-medium">Despesas</span>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative h-[220px] flex items-end justify-between gap-2 pt-6 border-b border-slate-200 dark:border-slate-800">
        {data.map((item, idx) => {
          const revHeightPct = Math.min((item.revenue / maxVal) * 100, 100);
          const expHeightPct = Math.min((item.expenses / maxVal) * 100, 100);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={item.month}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute -top-14 z-20 bg-slate-900 text-white text-[10px] p-2 rounded-xl shadow-xl border border-slate-700 whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95">
                  <p className="font-bold text-slate-300 mb-0.5">{item.month} / 2026</p>
                  <p className="text-emerald-400">Rec: {formatBRL(item.revenue)}</p>
                  <p className="text-rose-400">Desp: {formatBRL(item.expenses)}</p>
                </div>
              )}

              {/* Bars Pair */}
              <div className="w-full flex items-end justify-center gap-1 h-full pb-1">
                <div
                  style={{ height: `${Math.max(revHeightPct, 4)}%` }}
                  className={`w-1/2 rounded-t-md transition-all ${
                    item.revenue > 0 ? 'bg-emerald-500 group-hover:bg-emerald-400' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
                <div
                  style={{ height: `${Math.max(expHeightPct, 4)}%` }}
                  className={`w-1/2 rounded-t-md transition-all ${
                    item.expenses > 0 ? 'bg-rose-500 group-hover:bg-rose-400' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              </div>

              {/* Month Label */}
              <span className="text-[10px] text-slate-400 font-semibold mt-1">
                {item.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==============================================================================
// 2. Gráfico Donut de Despesas por Categoria (SVG Donut)
// ==============================================================================
interface CategoryDonutProps {
  categories: Record<string, number>;
}

export const CategoryDonutChart: React.FC<CategoryDonutProps> = ({ categories }) => {
  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#64748B', // Slate
  ];

  const entries = Object.entries(categories).filter(([_, val]) => val > 0);
  const total = entries.reduce((acc, [_, val]) => acc + val, 0);

  if (entries.length === 0 || total === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Nenhuma despesa registrada para o período selecionado.
      </div>
    );
  }

  // Calculate SVG stroke dashes
  let accumulatedAngle = 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* SVG Donut */}
      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="12"
            className="text-slate-100 dark:text-slate-800"
          />
          {entries.map(([_, val], i) => {
            const ratio = val / total;
            const strokeDasharray = `${ratio * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedAngle * circumference;
            accumulatedAngle += ratio;

            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={colors[i % colors.length]}
                strokeWidth="12"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        <div className="absolute text-center">
          <span className="text-[10px] text-slate-400 block font-medium">Total</span>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {formatBRL(total)}
          </span>
        </div>
      </div>

      {/* Legend List */}
      <div className="flex-1 space-y-2 w-full">
        {entries.map(([cat, val], i) => {
          const pct = ((val / total) * 100).toFixed(1);
          return (
            <div key={cat} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: colors[i % colors.length] }}
                />
                <span className="text-slate-700 dark:text-slate-300 truncate">{cat}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold text-slate-900 dark:text-white mr-1.5">
                  {formatBRL(val)}
                </span>
                <span className="text-[10px] text-slate-400">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
