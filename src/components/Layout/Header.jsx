import React from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Fixed import path

const Header = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) =>
    date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  const formatDate = (date) =>
    date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <header className="sticky top-0 z-30 shadow-sm bg-[#1f7ad9] text-white">
      <div className="flex items-center justify-between px-4 md:px-6 h-16 gap-4">
        {/* Left: Hamburger & System Name */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="rounded-lg bg-white/10 hover:bg-white/20 p-2 transition-colors"
            aria-label="Toggle navigation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.2em] text-blue-100">
              Hudi POS System
            </span>
            <span className="text-lg md:text-xl font-semibold leading-tight">
              Smart Restaurant & Cafe Suite
            </span>
          </div>
        </div>

        {/* Right: User + Clock + Logout */}
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[11px] uppercase tracking-wide text-blue-100">
              {user?.role ? user.role.toUpperCase() : 'USER'}
            </span>
            <span className="text-sm md:text-base font-semibold leading-tight">
              {user?.name || 'Staff Member'}
            </span>
          </div>

          <div className="flex flex-col items-end text-right">
            <span className="text-xs text-blue-100 font-medium">
              {formatDate(now)}
            </span>
            <span className="text-lg font-bold tracking-widest">
              {formatTime(now)}
            </span>
          </div>

          <button
            onClick={logout}
            className="bg-white text-blue-700 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm font-semibold shadow hover:bg-blue-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;