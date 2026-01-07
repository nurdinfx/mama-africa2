import React, { useState, useEffect } from 'react';
import { Shield, Key, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

const ActivationPage = () => {
    const [licenseKey, setLicenseKey] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [status, setStatus] = useState('checking'); // 'checking', 'unactivated', 'activated'
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await axios.get('/api/v1/license/status');
                if (response.data.success) {
                    setStatus('activated');
                } else {
                    setStatus('unactivated');
                    setDeviceId(response.data.deviceId);
                }
            } catch (err) {
                setStatus('unactivated');
            }
        };
        checkStatus();
    }, []);

    const handleActivate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            const response = await axios.post('/api/v1/license/activate', { licenseKey });
            if (response.data.success) {
                setStatus('activated');
                setMessage(response.data.message);
            } else {
                setMessage(response.data.message || 'Activation failed');
            }
        } catch (err) {
            setMessage(err.response?.data?.message || 'Activation failed. Please check your key.');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'checking') {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Checking License...</div>;
    }

    return (
        <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-blue-500/20 rounded-2xl">
                        <Shield className="text-blue-400" size={48} />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-center text-white mb-2">HUDI-SOFT Activation</h1>
                <p className="text-gray-400 text-center mb-8 text-sm">Professional Restaurant & POS Suite</p>

                {status === 'activated' ? (
                    <div className="text-center space-y-6">
                        <div className="flex justify-center">
                            <CheckCircle className="text-green-500" size={64} />
                        </div>
                        <p className="text-green-400 font-semibold text-lg">System Activated</p>
                        <p className="text-gray-400 text-sm">Your 5-year commercial license is active.</p>
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleActivate} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Device ID</label>
                            <div className="flex items-center space-x-2 bg-black/40 border border-white/5 p-3 rounded-xl">
                                <Smartphone size={16} className="text-gray-500" />
                                <span className="text-gray-300 font-mono text-sm truncate">{deviceId}</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">License Key</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="text"
                                    required
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    value={licenseKey}
                                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                                    className="w-full bg-black/20 border border-white/10 focus:border-blue-500/50 outline-none text-white pl-10 pr-4 py-3 rounded-xl transition-all"
                                />
                            </div>
                        </div>

                        {message && (
                            <div className={`p-4 rounded-xl flex items-start space-x-3 text-sm ${message.includes('success') ? 'bg-green-500/20 text-green-200 border border-green-500/30' : 'bg-red-500/20 text-red-200 border border-red-500/30'}`}>
                                {message.includes('success') ? <CheckCircle size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
                                <span>{message}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20"
                        >
                            {loading ? 'Activating...' : 'Activate License'}
                        </button>
                    </form>
                )}

                <div className="mt-8 text-center border-t border-white/5 pt-6">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">© 2025 HUDI-SOFT • SECURE LICENSING ENGINE</p>
                </div>
            </div>
        </div>
    );
};

export default ActivationPage;
