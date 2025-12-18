import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; // Fixed import path
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Sidebar drawer open/close (all breakpoints)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  // Auto-close mobile sidebar when route changes
  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (!user) {
    return <Outlet />;
  }

  return (
    <div className="app-shell overflow-hidden h-screen">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className="app-main flex-1 min-w-0 overflow-hidden">
        <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 w-full overflow-hidden h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;