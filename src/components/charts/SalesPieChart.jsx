import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const SalesPieChart = ({ products }) => {
    // Use product data primarily, or fallback to sample data if empty
    const data = products && products.length > 0
        ? products.map(product => ({
            name: product.name,
            value: product.totalQuantity || 0
        }))
        : [
            { name: 'Loading...', value: 100 }
        ];

    const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-slate-200 rounded shadow-md">
                    <p className="text-sm font-medium text-slate-800">{payload[0].name}</p>
                    <p className="text-sm text-slate-600">
                        Quantity: <span className="font-bold text-blue-600">{payload[0].value}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return percent > 0.05 ? (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        ) : null;
    };

    return (
        <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ paddingLeft: '20px' }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SalesPieChart;
