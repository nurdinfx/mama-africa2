// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Monitor, Phone, MapPin, ShieldCheck, Calendar, Info, Eye, EyeOff } from 'lucide-react';
import { realApi } from '../api/realApi'; // Import realApi for pre-fetching

const Login = () => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'quick'
  const [showPassword, setShowPassword] = useState(false);

  const { login, isAuthenticated, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      const timer = setTimeout(() => {
        navigate('/pos', { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, navigate]);

  const prefetchDashboardData = async () => {
    try {
      console.log('🚀 Pre-fetching dashboard data for instant load...');
      const timeframe = 'today';

      // Check online status before fetching
      if (!navigator.onLine) {
        console.log('📡 Offline: skipping dashboard pre-fetch');
        return;
      }

      const [statsResponse, activityResponse, productsResponse, salesResponse] = await Promise.allSettled([
        realApi.getStats(timeframe),
        realApi.getRecentActivity(6),
        realApi.getTopProducts(5),
        realApi.getDailySales(timeframe)
      ]);

      const initialStructure = {
        stats: {
          todayRevenue: 0,
          todayOrders: 0,
          completedOrders: 0,
          monthlyRevenue: 0,
          totalCustomers: 0,
          availableTables: 0,
          lowStockProducts: 0,
          averageOrderValue: 0,
          pendingOrders: 0,
          occupancyRate: 0
        },
        recentActivity: [],
        topProducts: [],
        dailySales: [],
        lastUpdated: new Date().toISOString()
      };

      const result = { ...initialStructure };

      if (statsResponse.status === 'fulfilled' && statsResponse.value.success) {
        const statsData = realApi.extractData(statsResponse.value) || {};
        result.stats = { ...initialStructure.stats, ...statsData };
      }

      if (activityResponse.status === 'fulfilled' && activityResponse.value.success) {
        result.recentActivity = realApi.extractData(activityResponse.value) || [];
      }

      if (productsResponse.status === 'fulfilled' && productsResponse.value.success) {
        result.topProducts = realApi.extractData(productsResponse.value) || [];
      }

      if (salesResponse.status === 'fulfilled' && salesResponse.value.success) {
        const salesResponseData = realApi.extractData(salesResponse.value) || {};
        result.dailySales = salesResponseData.revenueData || (Array.isArray(salesResponseData) ? salesResponseData : []);
      }

      // Store in localStorage for useOptimisticData hook
      localStorage.setItem(`dashboard_data_${timeframe}`, JSON.stringify({
        timestamp: Date.now(),
        data: result
      }));

      console.log('✅ Dashboard data pre-fetched and cached!');
    } catch (e) {
      console.warn('⚠️ Failed to pre-fetch dashboard data:', e);
      // Non-blocking, continue login
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const result = await login(formData.identifier, formData.password);
      if (!result.success) {
        setError(result.message || 'Login failed.');
        setLoading(false);
        return;
      }

      // Login successful, pre-fetch data while showing success state
      await prefetchDashboardData();

      // Redirect handled by useEffect, but we'll ensure state update implies it
    } catch (err) {
      setError(err.message || 'Login failed.');
      setLoading(false);
    }
    // Do not set loading false on success to prevent UI flash before redirect
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  // Loading state (initializing auth from persistence)
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black/90 text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
        <h2 className="text-xl font-bold tracking-wider">Initializing System...</h2>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="absolute inset-0 z-0">
          <img
            src="/login-bg.png"
            alt="Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div>
          <h2 className="text-2xl font-bold text-white">Welcome, {user?.name}</h2>
          <p className="text-white/70">Resuming Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative flex font-sans overflow-hidden bg-black">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0 scale-105 animate-pulse-slow">
        <img
          src="/hudi-bg.png"
          alt="Restaurant Background"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-black/80"></div>
      </div>

      <div className="relative z-10 flex w-full h-screen">
        {/* Left Side: About Hudi POS Content */}
        <div className="hidden lg:flex w-1/2 flex-col justify-center px-16 xl:px-24">
          <div className="space-y-8 animate-fadeIn">
            <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white/90 text-sm font-bold tracking-widest uppercase shadow-lg">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-3 animate-pulse"></span>
              Modern Restaurant Solution
            </div>

            <div className="space-y-4">
              <h1 className="text-6xl xl:text-7xl font-black text-white leading-tight drop-shadow-lg">
                HUDI <span className="text-blue-500">POS</span>
              </h1>
              <p className="text-xl text-white/80 font-medium max-w-lg leading-relaxed drop-shadow-md">
                Streamline your operations with our high-performance point of sale system. Designed for speed, reliability, and ease of use.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
              {[
                { icon: Monitor, title: "Smart Terminal", desc: "Intuitive touch interface" },
                { icon: ShieldCheck, title: "Secure Access", desc: "Multi-factor authentication" },
                { icon: Calendar, title: "Analytics", desc: "Real-time sales insights" },
                { icon: User, title: "Cloud Ready", desc: "Sync across all devices" }
              ].map((item, i) => (
                <div key={i} className="flex items-start space-x-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <item.icon className="text-blue-400" size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{item.title}</h4>
                    <p className="text-white/60 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Login Container */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
          <div className="w-full max-w-[480px] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col transition-all duration-500 hover:shadow-blue-500/10 hover:border-white/30 z-20">

            {/* Header/Tabs */}
            <div className="flex bg-white/5 border-b border-white/10">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-6 text-center text-sm font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'login'
                  ? 'text-white border-b-2 border-white bg-white/5'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
              >
                Staff Login
              </button>
              <button
                onClick={() => setActiveTab('quick')}
                className={`flex-1 py-6 text-center text-sm font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'quick'
                  ? 'text-white border-b-2 border-white bg-white/5'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
              >
                Quick PIN
              </button>
            </div>

            {/* Form Content */}
            <div className="p-8 sm:p-12">
              <div className="flex justify-center mb-8">
                <div className="h-20 w-20 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl flex items-center justify-center border border-white/20">
                  <Monitor size={40} className="text-white" />
                </div>
              </div>

              {activeTab === 'login' ? (
                <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
                  <div className="text-center mb-8">
                    <h3 className="text-3xl font-black text-white tracking-tight">MAMA AFRICA</h3>
                    <p className="text-white/60 text-sm mt-2 uppercase tracking-[0.2em]">Secure Terminal Access</p>
                  </div>

                  {error && (
                    <div className="bg-red-500/20 backdrop-blur-md text-red-200 p-4 rounded-2xl border border-red-500/30 text-sm flex items-start shadow-inner">
                      <Info size={18} className="mr-3 flex-shrink-0 mt-0.5" />
                      <span className="font-medium">{error}</span>
                    </div>
                  )}

                  <div className="space-y-5">
                    <div className="relative group">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-white/40 group-focus-within:text-white transition-colors" />
                        </div>
                        <input
                          name="identifier"
                          type="text"
                          required
                          placeholder="Username"
                          value={formData.identifier}
                          onChange={handleChange}
                          disabled={loading}
                          className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 focus:ring-2 focus:ring-white/20 focus:border-white/30 focus:bg-white/10 transition-all outline-none font-medium"
                        />
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-white/40 group-focus-within:text-white transition-colors" />
                        </div>
                        <input
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="Password"
                          value={formData.password}
                          onChange={handleChange}
                          disabled={loading}
                          className="block w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 focus:ring-2 focus:ring-white/20 focus:border-white/30 focus:bg-white/10 transition-all outline-none font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-white text-blue-900 hover:bg-blue-50 active:scale-[0.98] font-black py-4 rounded-2xl shadow-xl transition-all text-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-blue-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>INITIALIZING...</span>
                        </>
                      ) : (
                        <span>SIGN IN</span>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-6 animate-fadeIn">
                  <div>
                    <h3 className="text-3xl font-black text-white tracking-tight uppercase">Quick Access</h3>
                    <p className="text-white/60 mt-2 text-sm uppercase tracking-wider">Enter your Security PIN</p>
                  </div>

                  <div className="w-full max-w-xs grid grid-cols-3 gap-4 mt-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button key={num} className="h-16 rounded-2xl bg-white/5 border border-white/10 text-xl font-black text-white hover:bg-white/20 active:scale-90 transition-all shadow-lg">
                        {num}
                      </button>
                    ))}
                    <button className="h-16 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold hover:bg-white/20 active:scale-90 transition-all">C</button>
                    <button className="h-16 rounded-2xl bg-white/5 border border-white/10 text-xl font-black text-white hover:bg-white/20 active:scale-90 transition-all">0</button>
                    <button className="h-16 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all"><span className="text-xl">←</span></button>
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/10 w-full">
                    <button onClick={() => setActiveTab('login')} className="text-white/60 font-medium hover:text-white transition-colors text-sm uppercase tracking-widest">Use credentials instead</button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Info within card */}
            <div className="px-8 py-6 bg-white/5 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ShieldCheck size={16} className="text-white/40" />
                  <span className="text-[10px] text-white/40 font-mono tracking-widest">ID: MXLB151NU4</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[10px] text-green-400 font-bold uppercase tracking-tighter">System Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Footer - Adjusted Positioning */}
      <div className="absolute bottom-6 w-full px-10 z-20 flex flex-col md:flex-row items-center justify-between text-white/50">
        <div className="flex items-center space-x-6 text-xs font-bold uppercase tracking-[0.2em]">
          <div className="flex items-center space-x-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5">
            <Phone size={14} className="text-blue-400" />
            <span>0638326814</span>
          </div>
          <div className="flex items-center space-x-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5">
            <MapPin size={14} className="text-rose-400" />
            <span>LAASCAANOOD</span>
          </div>
        </div>

        <p className="text-[10px] font-medium tracking-[0.3em] uppercase mt-4 md:mt-0">
          © 2025 HUDI SYSTEM • SECURE TERMINAL V2.4
        </p>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.6; transform: scale(1.05); }
          50% { opacity: 0.7; transform: scale(1.08); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 20s ease-in-out infinite;
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Login;
