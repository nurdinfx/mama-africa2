import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';

const RevenueChart = ({ data, timeframe }) => {
  const chartData = data.length > 0 ? data : generateSampleData(timeframe);
  
  // Format tooltip value
  const formatCurrency = (value) => `$${value.toFixed(2)}`;
  
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-2">
            {new Date(label).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-medium text-slate-700">Revenue:</span>
              </div>
              <span className="font-bold text-emerald-600">
                ${payload[0].value.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm font-medium text-slate-700">Orders:</span>
              </div>
              <span className="font-bold text-blue-600">{payload[1]?.value || 0}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            fontSize={12}
            tickFormatter={(value) => {
              const date = new Date(value);
              if (timeframe === 'today') {
                return date.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false 
                });
              } else if (timeframe === 'week') {
                return date.toLocaleDateString('en-US', { weekday: 'short' });
              } else {
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }
            }}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={3}
            fill="url(#colorRevenue)"
            fillOpacity={1}
          />
          <Line
            type="monotone"
            dataKey="orders"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ stroke: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const generateSampleData = (timeframe) => {
  const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 24;
  const isToday = timeframe === 'today';
  
  return Array.from({ length: days }, (_, i) => {
    const baseDate = new Date();
    if (isToday) {
      // For today, generate hourly data
      baseDate.setHours(i, 0, 0, 0);
    } else {
      // For week/month, generate daily data
      baseDate.setDate(baseDate.getDate() - (days - i - 1));
      baseDate.setHours(12, 0, 0, 0);
    }
    
    return {
      date: baseDate.toISOString(),
      revenue: Math.floor(Math.random() * 3000) + 1000,
      orders: Math.floor(Math.random() * 40) + 15
    };
  });
};

export default RevenueChart;