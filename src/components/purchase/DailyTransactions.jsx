import React, { useState, useEffect } from 'react';
import { getPurchaseApi } from '../../services/api';

const DailyTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalTransactions: 0,
    bySupplier: {}
  });

  useEffect(() => {
    loadDailyTransactions();
  }, [selectedDate]);

  const loadDailyTransactions = async () => {
    setLoading(true);
    try {
      const purchaseApi = getPurchaseApi();
      const response = await purchaseApi.getDailyPurchases(selectedDate);
      const purchasesData = response.data?.purchases || response.data || [];
      const transactionsList = Array.isArray(purchasesData) ? purchasesData : [];

      // Calculate summary
      const totalAmount = transactionsList.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
      const bySupplier = {};
      transactionsList.forEach(t => {
        const supplierName = t.supplier?.name || 'Unknown';
        if (!bySupplier[supplierName]) {
          bySupplier[supplierName] = { count: 0, amount: 0 };
        }
        bySupplier[supplierName].count++;
        bySupplier[supplierName].amount += t.grandTotal || 0;
      });

      setTransactions(transactionsList);
      setSummary({
        totalAmount,
        totalTransactions: transactionsList.length,
        bySupplier
      });
    } catch (error) {
      console.error('Failed to load daily transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Daily Purchase Transactions</h2>
          <p className="text-gray-600">View all purchase transactions for a specific date</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <h3 className="text-sm font-medium text-green-800">Total Amount</h3>
          <p className="text-3xl font-bold text-green-600">
            ${summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800">Total Transactions</h3>
          <p className="text-3xl font-bold text-blue-600">{summary.totalTransactions}</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
          <h3 className="text-sm font-medium text-purple-800">Suppliers</h3>
          <p className="text-3xl font-bold text-purple-600">{Object.keys(summary.bySupplier).length}</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading transactions...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No transactions found for {selectedDate}
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transaction.supplier?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.items?.length || 0} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ${(transaction.grandTotal || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {transaction.paymentMethod || 'cash'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          transaction.status === 'paid' ? 'bg-green-100 text-green-800' :
                          transaction.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(transaction.status || 'draft').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier Breakdown */}
      {Object.keys(summary.bySupplier).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Supplier</h3>
          <div className="space-y-2">
            {Object.entries(summary.bySupplier).map(([supplier, data]) => (
              <div key={supplier} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">{supplier}</span>
                <div className="text-right">
                  <span className="text-sm text-gray-600">{data.count} transactions</span>
                  <span className="ml-4 font-semibold text-green-600">
                    ${data.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyTransactions;
