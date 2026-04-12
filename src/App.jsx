import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import BottomNav from './components/layout/BottomNav';

// Lazy load pages for better performance
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RoutersPage = lazy(() => import('./pages/RoutersPage'));
const CouponsPage = lazy(() => import('./pages/CouponsPage'));
const TicketsPage = lazy(() => import('./pages/TicketsPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ActiveUsersPage = lazy(() => import('./pages/ActiveUsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function App() {
  return (
    <Router>
      <div className="flex flex-col md:flex-row min-h-screen bg-bg-dark text-white selection:bg-primary/30">
        {/* Sidebar for Desktop */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <Topbar />
          
          <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            }>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/routers" element={<RoutersPage />} />
                <Route path="/coupons" element={<CouponsPage />} />
                <Route path="/tickets" element={<TicketsPage />} />
                <Route path="/monitoring" element={<MonitoringPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/active" element={<ActiveUsersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>

        {/* Bottom Navigation for Mobile */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
          <BottomNav />
        </div>
      </div>
    </Router>
  );
}

export default App;
