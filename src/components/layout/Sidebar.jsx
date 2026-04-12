import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Router, Ticket, Tag, Activity, BarChart3, Settings, Users, LineChart } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/routers', icon: Router, label: 'Routeurs' },
  { path: '/coupons', icon: Tag, label: 'Coupons' },
  { path: '/tickets', icon: Ticket, label: 'Tickets' },
  { path: '/monitoring', icon: Activity, label: 'Suivi' },
  { path: '/active', icon: Users, label: 'Actifs' },
  { path: '/sales', icon: BarChart3, label: 'Ventes' },
  { path: '/analytics', icon: LineChart, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Réglages' },
];

function Sidebar() {
  const { settings } = useSettings();

  return (
    <aside className="w-64 h-screen bg-white/5 border-r border-white/10 flex flex-col p-6 glass-card backdrop-blur-none rounded-none border-t-0 border-l-0 border-b-0">
      <div className="flex items-center gap-3 mb-12">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          {settings.logoBase64 ? (
            <img src={settings.logoBase64} alt="Logo" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <Activity className="text-bg-dark" />
          )}
        </div>
        <div>
          <h2 className="font-heading font-extrabold text-lg leading-tight uppercase">
            {settings.appName.split(' ')[0]}
            <span className="text-primary block text-sm font-body normal-case tracking-normal">Hotspot Manager</span>
          </h2>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-primary text-bg-dark font-bold shadow-lg shadow-primary/20 scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-body text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-4 py-6 border-t border-white/10">
        <p className="text-[10px] text-white/30 uppercase tracking-widest text-center">
          &copy; 2026 {settings.businessName}
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
