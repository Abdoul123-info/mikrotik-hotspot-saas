import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Router, Ticket, Tag, Activity, BarChart3, Settings, Users, LineChart, Radio, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/routers', icon: Router, label: 'Routeurs' },
  { path: '/profiles', icon: Zap, label: 'Profils' },
  { path: '/coupons', icon: Tag, label: 'Coupons' },
  // { path: '/tickets', icon: Ticket, label: 'Tickets' },
  { path: '/monitoring', icon: Activity, label: 'Suivi' },
  { path: '/active', icon: Users, label: 'Actifs' },
  { path: '/leases', icon: Radio, label: 'Appareils' },
  { path: '/sales', icon: BarChart3, label: 'Ventes' },
  { path: '/analytics', icon: LineChart, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Réglages' },
];

function BottomNav() {
  return (
    <nav className="h-20 bg-bg-dark/80 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-2 pb-2">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl transition-all ${
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-white/40 hover:text-white'
            }`
          }
        >
          <item.icon size={20} />
          <span className="text-[10px] font-medium leading-none">{item.label}</span>
        </NavLink>
      ))}
      {/* Mobile-only Tickets button (since we had to comment it to fit) */}
      <NavLink
          to="/tickets"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl transition-all ${
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-white/40 hover:text-white'
            }`
          }
        >
          <Ticket size={20} />
          <span className="text-[10px] font-medium leading-none">Tickets</span>
        </NavLink>
    </nav>
  );
}

export default BottomNav;
