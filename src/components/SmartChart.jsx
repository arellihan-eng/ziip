import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LabelList, ScatterChart, Scatter, ZAxis, Treemap, FunnelChart, Funnel,
  ComposedChart, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

const COLORS = ['#8b5cf6', '#d946ef', '#6366f1', '#ec4899', '#a855f7', '#f472b6', '#818cf8', '#c084fc', '#34d399', '#fbbf24'];

// Format large numbers
const formatNumber = (num) => {
  if (num === null || num === undefined) return '—';
  if (typeof num !== 'number') return num;
  if (Math.abs(num) >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const formatCurrency = (num) => {
  if (typeof num !== 'number') return num;
  if (Math.abs(num) >= 1000000000) return `$${(num / 1000000000).toFixed(1)}B`;
  if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const formatPercent = (num) => `${(num * 100).toFixed(1)}%`;

// Custom tooltip
const CustomTooltip = ({ active, payload, label, isCurrency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-slate-300 font-medium mb-1 text-sm">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm flex items-center gap-2" style={{ color: entry.color || entry.fill }}>
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color || entry.fill }} />
          {entry.name}: <span className="font-medium">{isCurrency ? formatCurrency(entry.value) : formatNumber(entry.value)}</span>
        </p>
      ))}
    </div>
  );
};

// KPI Card for single values
function KPICard({ value, label, change, isCurrency }) {
  const formatted = isCurrency ? formatCurrency(value) : formatNumber(value);
  const isPositive = change > 0;
  return (
    <div className="bg-slate-800/50 rounded-xl p-6 text-center">
      <div className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent mb-2">
        {formatted}
      </div>
      <div className="text-slate-400 text-sm">{label}</div>
      {change !== undefined && (
        <div className={`text-sm mt-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// Treemap custom content
const TreemapContent = ({ x, y, width, height, name, value, isCurrency }) => {
  if (width < 50 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="none" />
      <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontWeight="500">
        {name?.length > 15 ? name.slice(0, 15) + '...' : name}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        {isCurrency ? formatCurrency(value) : formatNumber(value)}
      </text>
    </g>
  );
};

export default function SmartChart({ data, schema, chartType = 'auto' }) {
  const analysis = useMemo(() => analyzeData(data, schema), [data, schema]);
  const preparedData = useMemo(() => prepareChartData(data, analysis, chartType), [data, analysis, chartType]);

  const effectiveChartType = chartType === 'auto' ? analysis.recommendedChart : chartType;

  // KPI mode for single value results
  if (data?.length === 1 && schema?.length <= 2) {
    const valueKey = analysis.valueKeys[0] || schema[schema.length - 1]?.name;
    const value = data[0][valueKey];
    if (typeof value === 'number' || typeof value === 'bigint') {
      return (
        <div className="h-80 flex items-center justify-center">
          <KPICard
            value={Number(value)}
            label={valueKey}
            isCurrency={analysis.isCurrency}
          />
        </div>
      );
    }
  }

  if (!preparedData.length || !analysis.labelKey) {
    return (
      <div className="h-80 flex items-center justify-center text-slate-500">
        Not enough data to visualize
      </div>
    );
  }

  const commonAxisProps = {
    stroke: '#64748b',
    tick: { fill: '#94a3b8', fontSize: 11 },
    tickLine: { stroke: '#475569' }
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        {effectiveChartType === 'bar' ? (
          <BarChart data={preparedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey={analysis.labelKey} {...commonAxisProps} angle={-45} textAnchor="end" height={80} interval={0} />
            <YAxis {...commonAxisProps} tickFormatter={analysis.isCurrency ? formatCurrency : formatNumber} />
            <Tooltip content={<CustomTooltip isCurrency={analysis.isCurrency} />} />
            {analysis.valueKeys.length > 1 && <Legend />}
            {analysis.valueKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]}>
                {preparedData.length <= 8 && analysis.valueKeys.length === 1 && (
                  <LabelList dataKey={key} position="top" fill="#94a3b8" fontSize={10} formatter={analysis.isCurrency ? formatCurrency : formatNumber} />
                )}
              </Bar>
            ))}
          </BarChart>
        ) : effectiveChartType === 'horizontal' ? (
          <BarChart data={preparedData} layout="vertical" margin={{ top: 20, right: 40, left: 100, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" {...commonAxisProps} tickFormatter={analysis.isCurrency ? formatCurrency : formatNumber} />
            <YAxis type="category" dataKey={analysis.labelKey} {...commonAxisProps} width={90} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip isCurrency={analysis.isCurrency} />} />
            {analysis.valueKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]}>
                <LabelList dataKey={key} position="right" fill="#94a3b8" fontSize={10} formatter={analysis.isCurrency ? formatCurrency : formatNumber} />
              </Bar>
            ))}
          </BarChart>
        ) : effectiveChartType === 'line' ? (
          <LineChart data={preparedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={analysis.labelKey} {...commonAxisProps} angle={-45} textAnchor="end" height={80} />
            <YAxis {...commonAxisProps} tickFormatter={analysis.isCurrency ? formatCurrency : formatNumber} />
            <Tooltip content={<CustomTooltip isCurrency={analysis.isCurrency} />} />
            {analysis.valueKeys.length > 1 && <Legend />}
            {analysis.valueKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
                dot={{ fill: COLORS[i % COLORS.length], strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }} />
            ))}
          </LineChart>
        ) : effectiveChartType === 'area' ? (
          <AreaChart data={preparedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <defs>
              {analysis.valueKeys.map((key, i) => (
                <linearGradient key={key} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={analysis.labelKey} {...commonAxisProps} angle={-45} textAnchor="end" height={80} />
            <YAxis {...commonAxisProps} tickFormatter={analysis.isCurrency ? formatCurrency : formatNumber} />
            <Tooltip content={<CustomTooltip isCurrency={analysis.isCurrency} />} />
            {analysis.valueKeys.length > 1 && <Legend />}
            {analysis.valueKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                fill={`url(#gradient-${i})`} />
            ))}
          </AreaChart>
        ) : effectiveChartType === 'pie' ? (
          <PieChart>
            <Pie data={preparedData} dataKey={analysis.valueKeys[0]} nameKey={analysis.labelKey}
              cx="50%" cy="50%" outerRadius={110} innerRadius={60} paddingAngle={2}
              label={({ name, percent }) => `${name?.slice(0, 12)}: ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#64748b', strokeWidth: 1 }}>
              {preparedData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip isCurrency={analysis.isCurrency} />} />
          </PieChart>
        ) : effectiveChartType === 'treemap' ? (
          <Treemap data={preparedData} dataKey={analysis.valueKeys[0]} nameKey={analysis.labelKey}
            aspectRatio={4 / 3} stroke="#1e293b" strokeWidth={2}
            content={<TreemapContent isCurrency={analysis.isCurrency} />}>
            {preparedData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
            ))}
          </Treemap>
        ) : effectiveChartType === 'scatter' && analysis.valueKeys.length >= 2 ? (
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={analysis.valueKeys[0]} name={analysis.valueKeys[0]} {...commonAxisProps}
              tickFormatter={formatNumber} type="number" />
            <YAxis dataKey={analysis.valueKeys[1]} name={analysis.valueKeys[1]} {...commonAxisProps}
              tickFormatter={formatNumber} type="number" />
            <ZAxis dataKey={analysis.valueKeys[2] || analysis.valueKeys[0]} range={[50, 400]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={preparedData} fill={COLORS[0]} fillOpacity={0.7} />
          </ScatterChart>
        ) : effectiveChartType === 'combo' ? (
          <ComposedChart data={preparedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={analysis.labelKey} {...commonAxisProps} angle={-45} textAnchor="end" height={80} />
            <YAxis {...commonAxisProps} tickFormatter={analysis.isCurrency ? formatCurrency : formatNumber} />
            <Tooltip content={<CustomTooltip isCurrency={analysis.isCurrency} />} />
            <Legend />
            {analysis.valueKeys[0] && <Bar dataKey={analysis.valueKeys[0]} fill={COLORS[0]} radius={[4, 4, 0, 0]} />}
            {analysis.valueKeys[1] && <Line type="monotone" dataKey={analysis.valueKeys[1]} stroke={COLORS[1]} strokeWidth={2.5} dot={{ r: 4 }} />}
          </ComposedChart>
        ) : effectiveChartType === 'radar' ? (
          <RadarChart data={preparedData} cx="50%" cy="50%" outerRadius={100}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey={analysis.labelKey} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fill: '#64748b', fontSize: 10 }} />
            {analysis.valueKeys.map((key, i) => (
              <Radar key={key} name={key} dataKey={key} stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]} fillOpacity={0.3} strokeWidth={2} />
            ))}
            <Legend />
            <Tooltip content={<CustomTooltip isCurrency={analysis.isCurrency} />} />
          </RadarChart>
        ) : (
          <BarChart data={preparedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={analysis.labelKey} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            {analysis.valueKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// Analyze data for best visualization
function analyzeData(data, schema) {
  if (!data?.length || !schema?.length) {
    return { labelKey: null, valueKeys: [], recommendedChart: 'bar', isCurrency: false };
  }

  const numericTypes = ['int', 'float', 'double', 'decimal', 'bigint', 'integer', 'number'];
  const datePatterns = ['date', 'time', 'month', 'year', 'day', 'week', 'quarter', 'period'];
  const currencyPatterns = ['amount', 'revenue', 'price', 'cost', 'total', 'sales', 'sum', 'value', 'profit', 'spend'];

  const numericCols = schema.filter(col =>
    numericTypes.some(t => col.type.toLowerCase().includes(t))
  );
  const nonNumericCols = schema.filter(col =>
    !numericTypes.some(t => col.type.toLowerCase().includes(t))
  );

  // Find best label column
  let labelKey = null;
  for (const col of nonNumericCols) {
    if (datePatterns.some(p => col.name.toLowerCase().includes(p))) {
      labelKey = col.name;
      break;
    }
  }
  if (!labelKey && nonNumericCols.length > 0) labelKey = nonNumericCols[0].name;
  if (!labelKey && schema.length > 0) labelKey = schema[0].name;

  const valueKeys = numericCols.slice(0, 3).map(col => col.name);
  if (valueKeys.length === 0 && schema.length >= 1) {
    valueKeys.push(schema[schema.length - 1].name);
  }

  // Detect currency
  const isCurrency = valueKeys.some(key =>
    currencyPatterns.some(p => key.toLowerCase().includes(p))
  ) || (data.length > 0 && valueKeys.some(key => {
    const val = data[0][key];
    return typeof val === 'number' && Math.abs(val) > 100;
  }));

  // Determine best chart
  const uniqueLabels = new Set(data.map(row => row[labelKey])).size;
  const isTimeSeries = labelKey && datePatterns.some(p => labelKey.toLowerCase().includes(p));
  const hasMultipleMetrics = valueKeys.length > 1;

  let recommendedChart = 'bar';
  if (data.length === 1) {
    recommendedChart = 'kpi';
  } else if (isTimeSeries) {
    recommendedChart = hasMultipleMetrics ? 'area' : 'line';
  } else if (uniqueLabels <= 6 && valueKeys.length === 1) {
    recommendedChart = 'pie';
  } else if (uniqueLabels > 10) {
    recommendedChart = 'horizontal';
  } else if (hasMultipleMetrics && uniqueLabels <= 8) {
    recommendedChart = 'combo';
  } else if (uniqueLabels >= 5 && uniqueLabels <= 12 && valueKeys.length === 1) {
    recommendedChart = 'treemap';
  }

  return { labelKey, valueKeys, recommendedChart, isCurrency, isTimeSeries };
}

// Prepare chart data
function prepareChartData(data, analysis, chartType) {
  if (!data?.length || !analysis.labelKey) return [];

  let prepared = data.map(row => {
    const cleaned = {};
    for (const key in row) {
      const val = row[key];
      cleaned[key] = typeof val === 'bigint' ? Number(val) : val;
    }
    return cleaned;
  });

  // Limit and sort based on chart type
  const maxItems = chartType === 'pie' ? 8 : chartType === 'treemap' ? 12 : chartType === 'radar' ? 8 : 15;

  if (prepared.length > maxItems) {
    const valueKey = analysis.valueKeys[0];
    if (valueKey) {
      prepared = prepared.sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0)).slice(0, maxItems);
    } else {
      prepared = prepared.slice(0, maxItems);
    }
  }

  // Sort for horizontal bars
  if (chartType === 'horizontal' && analysis.valueKeys[0]) {
    prepared = prepared.sort((a, b) => (a[analysis.valueKeys[0]] || 0) - (b[analysis.valueKeys[0]] || 0));
  }

  return prepared;
}

// SVG Icons for chart types
const ChartIcons = {
  table: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  bar: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="10" width="4" height="10" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="10" y="6" width="4" height="14" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="16" y="2" width="4" height="18" rx="1" fill="currentColor" opacity="0.7" />
    </svg>
  ),
  horizontal: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="18" height="4" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="2" y="10" width="12" height="4" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="2" y="16" width="8" height="4" rx="1" fill="currentColor" opacity="0.3" />
    </svg>
  ),
  line: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3,18 8,12 13,15 21,6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      <circle cx="13" cy="15" r="1.5" fill="currentColor" />
      <circle cx="21" cy="6" r="1.5" fill="currentColor" />
    </svg>
  ),
  area: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3,20 L3,18 L8,12 L13,15 L21,6 L21,20 Z" fill="currentColor" opacity="0.3" />
      <polyline points="3,18 8,12 13,15 21,6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pie: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12,3 L12,12 L20.5,8" fill="currentColor" opacity="0.4" />
      <line x1="12" y1="12" x2="12" y2="3" />
      <line x1="12" y1="12" x2="20.5" y2="8" />
      <line x1="12" y1="12" x2="5" y2="17" />
    </svg>
  ),
  treemap: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="15" y="3" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="15" y="11" width="6" height="2" rx="0.5" fill="currentColor" opacity="0.2" />
      <rect x="3" y="15" width="6" height="6" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="11" y="15" width="10" height="6" rx="1" fill="currentColor" opacity="0.3" />
    </svg>
  ),
  combo: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="12" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.4" />
      <rect x="10" y="8" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.4" />
      <rect x="16" y="10" width="3" height="10" rx="0.5" fill="currentColor" opacity="0.4" />
      <polyline points="5.5,8 11.5,4 17.5,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5.5" cy="8" r="1.5" fill="currentColor" />
      <circle cx="11.5" cy="4" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="6" r="1.5" fill="currentColor" />
    </svg>
  ),
  scatter: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="16" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="10" cy="10" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="15" cy="14" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="18" cy="6" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="8" cy="6" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="17" cy="17" r="2" fill="currentColor" opacity="0.6" />
    </svg>
  ),
  radar: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12,2 20,8 18,18 6,18 4,8" fill="none" strokeOpacity="0.3" />
      <polygon points="12,6 16,9 15,15 9,15 8,9" fill="currentColor" opacity="0.3" />
      <line x1="12" y1="12" x2="12" y2="2" strokeOpacity="0.3" />
      <line x1="12" y1="12" x2="20" y2="8" strokeOpacity="0.3" />
      <line x1="12" y1="12" x2="18" y2="18" strokeOpacity="0.3" />
      <line x1="12" y1="12" x2="6" y2="18" strokeOpacity="0.3" />
      <line x1="12" y1="12" x2="4" y2="8" strokeOpacity="0.3" />
    </svg>
  ),
};

// Chart type selector with slick icons and tooltips
export function ChartTypeSelector({ value, onChange, recommended }) {
  const types = [
    { key: 'table', label: 'Table', desc: 'View raw data in rows and columns' },
    { key: 'bar', label: 'Bar Chart', desc: 'Compare values across categories' },
    { key: 'horizontal', label: 'Ranked Bars', desc: 'Rank items from highest to lowest' },
    { key: 'line', label: 'Line Chart', desc: 'Show trends over time or sequence' },
    { key: 'area', label: 'Area Chart', desc: 'Emphasize volume and cumulative trends' },
    { key: 'pie', label: 'Pie Chart', desc: 'Show proportions of a whole' },
    { key: 'treemap', label: 'Treemap', desc: 'Visualize hierarchical data by size' },
    { key: 'combo', label: 'Combo Chart', desc: 'Combine bars and lines for dual metrics' },
    { key: 'scatter', label: 'Scatter Plot', desc: 'Find correlations between two values' },
    { key: 'radar', label: 'Radar Chart', desc: 'Compare multiple dimensions at once' },
  ];

  return (
    <div className="flex bg-slate-800 rounded-lg p-1 gap-0.5 flex-wrap relative" style={{ zIndex: 100 }}>
      {types.map(type => (
        <div key={type.key} className="relative group">
          <button
            onClick={() => onChange(type.key)}
            className={`px-2.5 py-1.5 rounded-md transition flex items-center gap-1 ${
              value === type.key
                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {ChartIcons[type.key]}
            {type.key === recommended && value !== type.key && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </button>
          {/* Tooltip - appears below to avoid header overlap */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap" style={{ zIndex: 9999 }}>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-1px] border-4 border-transparent border-b-slate-700" />
            <div className="text-white text-sm font-medium">{type.label}</div>
            <div className="text-slate-400 text-xs mt-0.5">{type.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Smart Filters Component
export function SmartFilters({ data, schema, filters, onFilterChange }) {
  const filterableColumns = useMemo(() => {
    if (!data?.length || !schema?.length) return [];

    return schema.map(col => {
      const values = data.map(row => row[col.name]);
      const uniqueValues = [...new Set(values)].filter(v => v != null);
      const isNumeric = ['int', 'float', 'double', 'decimal', 'bigint', 'integer'].some(t =>
        col.type.toLowerCase().includes(t)
      );

      if (isNumeric) {
        const nums = values.filter(v => typeof v === 'number' || typeof v === 'bigint').map(Number);
        return {
          ...col,
          type: 'numeric',
          min: Math.min(...nums),
          max: Math.max(...nums),
          values: null
        };
      } else if (uniqueValues.length <= 20) {
        return {
          ...col,
          type: 'category',
          values: uniqueValues.sort(),
          count: uniqueValues.length
        };
      }
      return null;
    }).filter(Boolean);
  }, [data, schema]);

  if (!filterableColumns.length) return null;

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-slate-800/30 rounded-xl mb-4">
      <span className="text-slate-500 text-xs uppercase tracking-wide self-center mr-2">Filters:</span>
      {filterableColumns.slice(0, 5).map(col => (
        <FilterChip
          key={col.name}
          column={col}
          value={filters?.[col.name]}
          onChange={(val) => onFilterChange({ ...filters, [col.name]: val })}
        />
      ))}
      {Object.keys(filters || {}).length > 0 && (
        <button
          onClick={() => onFilterChange({})}
          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterChip({ column, value, onChange }) {
  const [open, setOpen] = useState(false);
  const hasValue = value !== undefined && value !== null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
          hasValue
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-transparent'
        }`}
      >
        {column.name}
        {hasValue && <span className="text-violet-400">: {String(value).slice(0, 15)}</span>}
        <span className="text-slate-500">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 min-w-[180px] max-h-[200px] overflow-auto">
            {column.type === 'category' ? (
              <>
                <button
                  onClick={() => { onChange(null); setOpen(false); }}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                    !hasValue ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  All
                </button>
                {column.values.map(v => (
                  <button
                    key={v}
                    onClick={() => { onChange(v); setOpen(false); }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                      value === v ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {String(v)}
                  </button>
                ))}
              </>
            ) : (
              <div className="p-2 text-xs text-slate-400">
                Range: {formatNumber(column.min)} - {formatNumber(column.max)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Quick Insights - auto-generated observations
export function QuickInsights({ data, schema, valueKeys }) {
  const insights = useMemo(() => {
    if (!data?.length || !valueKeys?.length) return [];

    const results = [];
    const valueKey = valueKeys[0];
    const values = data.map(row => Number(row[valueKey]) || 0);

    // Total
    const total = values.reduce((a, b) => a + b, 0);
    results.push({ type: 'total', label: 'Total', value: total });

    // Average
    const avg = total / values.length;
    results.push({ type: 'avg', label: 'Average', value: avg });

    // Max
    const maxIdx = values.indexOf(Math.max(...values));
    const labelKey = schema.find(s => !['int', 'float', 'double', 'decimal', 'bigint', 'integer'].some(t => s.type.toLowerCase().includes(t)))?.name;
    if (labelKey) {
      results.push({ type: 'max', label: 'Highest', value: data[maxIdx][valueKey], detail: data[maxIdx][labelKey] });
    }

    // Top 3 share
    const sorted = [...values].sort((a, b) => b - a);
    const top3Share = (sorted.slice(0, 3).reduce((a, b) => a + b, 0) / total) * 100;
    if (top3Share > 0) {
      results.push({ type: 'concentration', label: 'Top 3 share', value: top3Share, suffix: '%' });
    }

    return results;
  }, [data, schema, valueKeys]);

  if (!insights.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {insights.map((insight, i) => (
        <div key={i} className="bg-slate-800/30 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-white">
            {insight.suffix === '%' ? `${insight.value.toFixed(1)}%` : formatNumber(insight.value)}
          </div>
          <div className="text-xs text-slate-400">{insight.label}</div>
          {insight.detail && <div className="text-xs text-violet-400 mt-1">{insight.detail}</div>}
        </div>
      ))}
    </div>
  );
}
