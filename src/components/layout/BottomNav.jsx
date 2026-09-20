import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Router, 
  Ticket, 
  Tag, 
  Activity, 
  BarChart3, 
  Settings, 
  Users, 
  LineChart, 
  Radio, 
  Zap,
  Grid2X2,
  X
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', desc: 'Vue générale' },
  { path: '/routers', icon: Router, label: 'Routeurs', desc: 'Gestion MikroTik' },
  { path: '/active', icon: Users, label: 'Actifs', desc: 'Sessions connectées' },
  { path: '/tickets', icon: Ticket, label: 'Tickets', desc: 'Vouchers & codes' },
  { path: '/sales', icon: BarChart3, label: 'Ventes', desc: 'Recettes & caisse' },
  { path: '/profiles', icon: Zap, label: 'Profils', desc: 'Tarifs & vitesses' },
  { path: '/coupons', icon: Tag, label: 'Coupons', desc: 'Génération de lots' },
  { path: '/leases', icon: Radio, label: 'Appareils', desc: 'Baux DHCP & Wi-Fi' },
  { path: '/monitoring', icon: Activity, label: 'Suivi', desc: 'CPU, RAM & Débit' },
  { path: '/analytics', icon: LineChart, label: 'Analytics', desc: 'Graphiques & bilans' },
  { path: '/settings', icon: Settings, label: 'Réglages', desc: 'Options & système' },
];

function BottomNav() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const activeTabRef = useRef(null);

  // Défilement automatique pour centrer l'onglet actif au chargement ou au changement de page
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [location.pathname]);

  return (
    <>
      {/* ─── Barre de navigation principale (Scroll fluide sans compression) ─── */}
      <nav className="h-16 bg-[#07090D]/95 backdrop-blur-2xl border-t border-white/10 flex items-center relative shadow-2xl">
        <div className="flex items-center gap-1.5 px-3 overflow-x-auto no-scrollbar scroll-smooth w-full py-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                ref={isActive ? activeTabRef : null}
                className={`flex flex-col items-center justify-center gap-1 shrink-0 px-3 py-1.5 h-13 min-w-[66px] rounded-xl transition-all ${
                  isActive
                    ? 'text-primary bg-primary/10 border border-primary/25 shadow-md shadow-primary/10 font-bold'
                    : 'text-white/40 hover:text-white hover:bg-white/5 font-medium'
                }`}
              >
                <item.icon size={19} className={isActive ? 'text-primary' : 'text-white/40'} />
                <span className="text-[10px] tracking-tight whitespace-nowrap leading-none">
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* Bouton Menu / Tout voir */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 shrink-0 px-3 py-1.5 h-13 min-w-[62px] rounded-xl text-white/40 hover:text-primary hover:bg-white/5 transition-all font-medium border border-dashed border-white/10 ml-0.5"
            title="Toutes les options"
          >
            <Grid2X2 size={19} />
            <span className="text-[10px] tracking-tight whitespace-nowrap leading-none">
              Menu
            </span>
          </button>
        </div>
      </nav>

      {/* ─── Drawer / Bottom Sheet "Toutes les options" ─── */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMenuOpen(false)}
        >
          <div 
            className="bg-[#0D1017] border-t border-white/10 rounded-t-3xl p-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Poignée + En-tête */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Grid2X2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider">Toutes les options</h3>
                  <p className="text-[10px] text-white/40">Accès direct à toutes les rubriques</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Grille des 11 modules */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-primary/15 border-primary/40 text-primary shadow-lg shadow-primary/10'
                        : 'bg-white/[0.02] border-white/5 text-white hover:bg-white/[0.06] hover:border-white/10'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-primary text-bg-dark font-black' : 'bg-white/5 text-white/60'
                    }`}>
                      <item.icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-heading font-black truncate">{item.label}</p>
                      <p className="text-[9px] text-white/30 truncate">{item.desc}</p>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BottomNav;
