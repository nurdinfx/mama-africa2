import React, { useState, useEffect } from 'react';
import { getPurchaseApi } from '../../services/api';

const ProductReport = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadProductReport();
  }, [filters]);

  const loadProductReport = async () => {
    setLoading(true);
    try {
      const purchaseApi = getPurchaseApi();
      const response = await purchaseApi.getPurchases({
        from: filters.startDate,
        to: filters.endDate
      });
      
      const purchases = response.data?.purchases || response.data || [];
      const purchasesList = Array.isArray(purchases) ? purchases : [];

      // Analyze product purchases
      const productStats = {};
      purchasesList.forEach(purchase => {
        if (purchase.items && Array.isArray(purchase.items)) {
          purchase.items.forEach(item => {
            const productId = item.productId || item.product?._id;
            const productName = item.product?.name || item.productName || 'Unknown Product';
            
            if (!productStats[productId]) {
              productStats[productId] = {
                name: productName,
                totalQuantity: 0,
                totalAmount: 0,
                purchaseCount: 0,
                averageCost: 0
              };
            }
            
            productStats[productId].totalQuantity += item.qty || 0;
            productStats[productId].totalAmount += item.total || 0;
            productStats[productId].purchaseCount += 1;
          });
        }
      });

      // Calculate averages
      Object.values(productStats).forEach(stat => {
        stat.averageCost = stat.purchaseCount > 0 ? stat.totalAmount / stat.totalQuantity : 0;
      });

      setReportData({
        products: Object.values(productStats).sort((a, b) => b.totalAmount - a.totalAmount),
        summary: {
          totalProducts: Object.keys(productStats).length,
          totalPurchases: purchasesList.length,
          totalAmount: purchasesList.reduce((sum, p) => sum + (p.grandTotal || 0), 0)
        }
      });
    } catch (error) {
      console.error('Failed to load product report:', error);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!reportData) return;
    
    const headers = ['Product Name', 'Total Quantity', 'Total Amount', 'Purchase Count', 'Average Cost'];
    const rows = reportData.products.map(product => [
      product.name,
      product.totalQuantity,
      product.totalAmount.toFixed(2),
      product.purchaseCount,
      product.averageCost.toFixed(2)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-report-${filters.startDate}-${filters.endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Purchase Report</h2>
          <p className="text-gray-600">Analyze product purchases and trends</p>
        </div>
        {reportData && (
          <button
            onClick={exportReport}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({
                  startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
                  endDate: new Date().toISOString().split('T')[0]
                });
              }}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h3 className="text-sm font-medium text-green-800">Total Products</h3>
            <p className="text-3xl font-bold text-green-600">{reportData.summary.totalProducts}</p>
          </div>
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-sm font-medium text-blue-800">Total Purchases</h3>
            <p className="text-3xl font-bold text-blue-600">{reportData.summary.totalPurchases}</p>
          </div>
          <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
            <h3 className="text-sm font-medium text-purple-800">Total Amount</h3>
            <p className="text-3xl font-bold text-purple-600">
              ${reportData.summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading product report...</p>
          </div>
        ) : reportData ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average Cost</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.products.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                      No product purchases found for the selected period
                    </td>
                  </tr>
                ) : (
                  reportData.products.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.totalQuantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ${product.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.purchaseCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${product.averageCost.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            No data available
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductReport;
