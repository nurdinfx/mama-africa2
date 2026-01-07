import React, { useState, useEffect } from 'react';
import { Users, Shield, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';
import axios from 'axios';

const AdminLicenseDashboard = () => {
    const [licenses, setLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // This would normally fetch from a CENTRAL MongoDB, not local SQLite.
        // For this demonstration/implementation, we'll fetch from the local backend
        // which the admin can use to see all registered devices in their network.
        const fetchLicenses = async () => {
            try {
                const response = await axios.get('/api/v1/license/status'); // Simplified
                if (response.data.success) {
                    setLicenses([response.data.license]); // Mocking a list for Now
                }
            } catch (err) {
                console.error('Failed to fetch licenses');
            } finally {
                setLoading(false);
            }
        };
        fetchLicenses();
    }, []);

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">License Management</h1>
                        <p className="text-gray-500">Manage device activations and client renewals</p>
                    </div>
                    <div className="flex space-x-4">
                        <button className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                            + Generate Keys
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                        <div className="p-4 bg-green-100 rounded-xl text-green-600">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Active Licenses</p>
                            <h3 className="text-2xl font-bold">1/1</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                        <div className="p-4 bg-yellow-100 rounded-xl text-yellow-600">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Expiring Soon</p>
                            <h3 className="text-2xl font-bold">0</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                        <div className="p-4 bg-blue-100 rounded-xl text-blue-600">
                            <Shield size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Devices</p>
                            <h3 className="text-2xl font-bold">1</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative max-w-md w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search Device ID or Key..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Filter size={18} className="text-gray-400" />
                            <select className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500">
                                <option>All Status</option>
                                <option>Active</option>
                                <option>Expired</option>
                                <option>Suspended</option>
                            </select>
                        </div>
                    </div>

                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Client / Device ID</th>
                                <th className="px-6 py-4">License Key</th>
                                <th className="px-6 py-4">Activation Date</th>
                                <th className="px-6 py-4">Expiry Date</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {licenses.map((license, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-all">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                                {license?.deviceId?.charAt(0).toUpperCase() || 'D'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{license?.deviceId?.substring(0, 12)}...</p>
                                                <p className="text-xs text-gray-500">Local Device</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm text-gray-600">{license?.licenseKey}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(license?.startDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(license?.expiryDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${license?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {license?.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-blue-600 font-bold text-sm hover:underline">Manage</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {licenses.length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                            No licenses found matching your criteria.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminLicenseDashboard;
