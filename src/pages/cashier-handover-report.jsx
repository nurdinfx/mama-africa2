import React from 'react';
import { Link } from 'react-router-dom';

const CashierHandoverReport = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Cashier Handover Report</h1>
        <p className="text-gray-600">All Cashier Handovers Report</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="#" className="bg-blue-600 text-white rounded-lg p-8 text-center hover:bg-blue-700">
          Previous Payment Report
        </Link>
        <Link to="#" className="bg-blue-600 text-white rounded-lg p-8 text-center hover:bg-blue-700">
          Advance Adjusted Report
        </Link>
        <Link to="#" className="bg-blue-600 text-white rounded-lg p-8 text-center hover:bg-blue-700">
          Sale Summary Report
        </Link>
      </div>
    </div>
  );
};

export default CashierHandoverReport;

