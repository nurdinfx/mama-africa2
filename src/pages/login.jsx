// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Monitor, Phone, MapPin, ShieldCheck, Calendar, Info } from 'lucide-react';

const Login = () => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'quick'

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const result = await login(formData.identifier, formData.password);
      if (!result.success) {
        setError(result.message || 'Login failed.');
        return;
      }
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
        <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}</h2>
        <p className="text-gray-500">Initializing POS System...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white flex flex-col md:flex-row font-sans overflow-hidden">

      {/* LEFT PANEL: Login Form */}
      <div className="w-full md:w-1/2 h-full flex flex-col relative bg-white z-10">

        {/* Mobile Header (Brand visible on mobile only) */}
        <div className="md:hidden p-6 bg-blue-600 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2">
            <Monitor size={24} className="text-white" />
            <span className="font-bold text-lg">Hudi POS</span>
          </div>
          <span className="text-xs font-medium opacity-80">v2.4</span>
        </div>

        {/* Tabs - Now sticky at top of form area */}
        <div className="flex border-b border-gray-100 w-full">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-5 text-center text-sm font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'login'
              ? 'text-blue-600 border-b-4 border-blue-600 bg-blue-50/50'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
          >
            User Login
          </button>
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-5 text-center text-sm font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'quick'
              ? 'text-blue-600 border-b-4 border-blue-600 bg-blue-50/50'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
          >
            Quick Access
          </button>
        </div>

        {/* Form Container - Centered Vertically */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 py-12 overflow-y-auto">

          <div className="w-full max-w-md mx-auto">
            {activeTab === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-8 animate-fadeIn">
                <div className="text-left mb-10">
                  <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Welcome Back</h3>
                  <p className="text-gray-500 text-base mt-2">Sign in to access your POS terminal</p>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl border-l-4 border-red-500 text-sm flex items-start shadow-sm mb-6">
                    <Info size={18} className="mr-3 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="relative group">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">Username</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-6 w-6 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      </div>
                      <input
                        name="identifier"
                        type="text"
                        required
                        placeholder="Enter username"
                        value={formData.identifier}
                        onChange={handleChange}
                        disabled={loading}
                        className="block w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-lg text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="relative group">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-6 w-6 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      </div>
                      <input
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        disabled={loading}
                        className="block w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-lg text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-5 rounded-xl shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all text-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </div>

                <div className="text-center mt-6">
                  <p className="text-sm text-gray-400">Restricted Access • Authorized Personnel Only</p>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-fadeIn py-10">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-2 animate-pulse">
                  <ShieldCheck size={48} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Quick Access</h3>
                  <p className="text-gray-500 mt-2 max-w-xs mx-auto">Use your PIN or biometric scan to access the terminal instantly.</p>
                </div>

                <div className="w-full max-w-xs grid grid-cols-3 gap-3 mt-8">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} className="h-16 rounded-lg bg-gray-50 border border-gray-200 text-xl font-bold text-gray-700 hover:bg-white hover:border-blue-400 hover:text-blue-600 shadow-sm transition-all">
                      {num}
                    </button>
                  ))}
                  <button className="h-16 rounded-lg bg-gray-100 text-gray-400 font-bold col-span-1">C</button>
                  <button className="h-16 rounded-lg bg-gray-50 border border-gray-200 text-xl font-bold text-gray-700 hover:bg-white hover:border-blue-400 hover:text-blue-600 shadow-sm">0</button>
                  <button className="h-16 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><span className="text-xl">←</span></button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100 w-full">
                  <button onClick={() => setActiveTab('login')} className="text-blue-600 font-medium hover:underline text-sm">Use Username & Password instead</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 text-center md:text-left border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-gray-400 font-medium tracking-wide">© 2025 Hudi System • Secure Terminal v2.4</span>
        </div>
      </div>

      {/* RIGHT PANEL: System Info (Hidden on mobile, full width on desktop) */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#1e40af] via-[#1e3a8a] to-[#172554] relative overflow-hidden items-center justify-center p-12 lg:p-20 text-white">

        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] rounded-full bg-blue-500 opacity-10 blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] rounded-full bg-purple-600 opacity-10 blur-[100px]"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>

        <div className="relative z-10 w-full max-w-lg">
          <div className="mb-12">
            <div className="h-24 w-24 bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl flex items-center justify-center border border-white/20 mb-8">
              <Monitor size={48} className="text-white" />
            </div>

            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-4">
              Hudi <br />
              <span className="text-blue-300">POS System</span>
            </h1>
            <p className="text-white/90 text-2xl font-medium mb-2 font-mono">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-blue-100/80 text-xl font-light leading-relaxed max-w-md">
              The complete restaurant management solution designed for speed, reliability, and growth.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Info Card 1 */}
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex items-start space-x-4 hover:bg-white/15 transition-all cursor-default">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Phone size={24} className="text-blue-200" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-200 uppercase tracking-wider mb-1">Support Line</h4>
                <p className="text-2xl font-semibold text-white">0638326814</p>
                <p className="text-sm text-blue-200/60 mt-1">Available 24/7 for technical assistance</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Info Card 2 */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-all">
                <div className="flex items-center space-x-2 text-blue-200 mb-2">
                  <MapPin size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Location</span>
                </div>
                <p className="font-medium text-white truncate">Laascaanood, Somalia</p>
              </div>

              {/* Info Card 3 */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-all">
                <div className="flex items-center space-x-2 text-blue-200 mb-2">
                  <Calendar size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Expiry</span>
                </div>
                <p className="font-medium text-white font-mono">20-Dec-2025</p>
              </div>
            </div>

            {/* Machine Code */}
            <div className="bg-black/20 rounded-xl p-4 flex items-center justify-between border border-white/5">
              <div className="flex items-center space-x-3">
                <ShieldCheck size={20} className="text-gray-400" />
                <span className="text-sm text-gray-400 font-medium">Terminal ID</span>
              </div>
              <span className="font-mono text-white/90 tracking-widest">MXLB151NU4</span>
            </div>

          </div>
        </div>

        {/* Decorative Quote or Tagline */}
        <div className="absolute bottom-10 right-10 text-right opacity-30">
        </div>
      </div>
    </div>
  );
};

export default Login;
