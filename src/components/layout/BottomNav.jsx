import React, { useState } from 'react';
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
  MoreHorizontal,
  X,
  ChevronRight
} from 'lucide-react';

// ─── Les 5 onglets principaux visibles en permanence ──────────────────────────
const PRIMARY_TABS = [
  { path: '/', icon: LayoutDashboard, label: 'Accueil' },
  { path: '/active', icon: Users, label: 'Actifs' },
  { path: '/sales', icon: BarChart3, label: 'Ventes' },
  { path: '/coupons', icon: Tag, label: 'Coupons' },
];

// ─── Tous les modules pour le drawer ──────────────────────────────────────────
const ALL_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Tableau de bord', desc: 'Aperçu général de votre activité', color: 'from-emerald-500/20 to-emerald-600/10', iconColor: 'text-emerald-400' },
  { path: '/active', icon: Users, label: 'Utilisateurs actifs', desc: 'Sessions connectées en temps réel', color: 'from-blue-500/20 to-blue-600/10', iconColor: 'text-blue-400' },
  { path: '/routers', icon: Router, label: 'Routeurs', desc: 'Gestion de vos équipements MikroTik', color: 'from-violet-500/20 to-violet-600/10', iconColor: 'text-violet-400' },
  { path: '/profiles', icon: Zap, label: 'Profils', desc: 'Tarifs, vitesses et limites', color: 'from-amber-500/20 to-amber-600/10', iconColor: 'text-amber-400' },
  { path: '/coupons', icon: Tag, label: 'Coupons', desc: 'Générer des lots de vouchers', color: 'from-pink-500/20 to-pink-600/10', iconColor: 'text-pink-400' },
  { path: '/tickets', icon: Ticket, label: 'Tickets', desc: 'Historique des vouchers vendus', color: 'from-cyan-500/20 to-cyan-600/10', iconColor: 'text-cyan-400' },
  { path: '/sales', icon: BarChart3, label: 'Ventes', desc: 'Recettes journalières et caisse', color: 'from-green-500/20 to-green-600/10', iconColor: 'text-green-400' },
  { path: '/leases', icon: Radio, label: 'Appareils', desc: 'Baux DHCP et clients Wi-Fi', color: 'from-orange-500/20 to-orange-600/10', iconColor: 'text-orange-400' },
  { path: '/monitoring', icon: Activity, label: 'Monitoring', desc: 'CPU, RAM et débit en direct', color: 'from-red-500/20 to-red-600/10', iconColor: 'text-red-400' },
  { path: '/analytics', icon: LineChart, label: 'Analytics', desc: 'Graphiques et bilans détaillés', color: 'from-indigo-500/20 to-indigo-600/10', iconColor: 'text-indigo-400' },
  { path: '/settings', icon: Settings, label: 'Réglages', desc: 'Configuration et préférences', color: 'from-slate-500/20 to-slate-600/10', iconColor: 'text-slate-400' },
];

function BottomNav() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Vérifier si la page active est dans les onglets secondaires (drawer)
  const isSecondaryActive = !PRIMARY_TABS.some(t => t.path === location.pathname);

  return (
    <>
      {/* ─── Barre de navigation fixe : 5 onglets + Plus ─── */}
      <nav className="h-[68px] bg-[#080A0F]/98 backdrop-blur-2xl border-t border-white/[0.06] flex items-stretch">
        <div className="flex items-stretch w-full">

          {PRIMARY_TABS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex-1 flex flex-col items-center justify-center gap-[5px] relative transition-colors duration-200"
              >
                {/* Indicateur lumineux actif */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-primary shadow-[0_0_8px_rgba(0,229,160,0.6)]" />
                )}
                <item.icon 
                  size={21} 
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className={`transition-colors duration-200 ${isActive ? 'text-primary' : 'text-white/35'}`} 
                />
                <span className={`text-[10px] font-body leading-none transition-colors duration-200 ${
                  isActive 
                    ? 'text-primary font-bold' 
                    : 'text-white/35 font-medium'
                }`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* Bouton "Plus" */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-[5px] relative transition-colors duration-200"
          >
            {isSecondaryActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-primary shadow-[0_0_8px_rgba(0,229,160,0.6)]" />
            )}
            <MoreHorizontal 
              size={21} 
              strokeWidth={isSecondaryActive ? 2.4 : 1.8}
              className={`transition-colors duration-200 ${isSecondaryActive ? 'text-primary' : 'text-white/35'}`}
            />
            <span className={`text-[10px] font-body leading-none transition-colors duration-200 ${
              isSecondaryActive 
                ? 'text-primary font-bold' 
                : 'text-white/35 font-medium'
            }`}>
              Plus
            </span>
          </button>
        </div>
      </nav>

      {/* ─── Bottom Sheet / Drawer ─── */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-[60] flex flex-col justify-end"
          onClick={() => setIsMenuOpen(false)}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
               style={{ animation: 'fadeIn 0.2s ease-out' }} />

          {/* Sheet */}
          <div 
            className="relative bg-gradient-to-b from-[#0E1118] to-[#0A0D12] border-t border-white/[0.08] rounded-t-[28px] max-h-[82vh] overflow-hidden flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.5)]"
            style={{ animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Poignée */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* En-tête */}
            <div className="flex items-center justify-between px-5 pb-4 pt-2">
              <div>
                <h3 className="text-[15px] font-heading font-black text-white tracking-wide">NAVIGATION</h3>
                <p className="text-[11px] text-white/30 font-body mt-0.5">Accédez à toutes les rubriques</p>
              </div>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Séparateur */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mx-4" />

            {/* Liste des modules */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 no-scrollbar">
              {ALL_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-primary/[0.08] border border-primary/20'
                        : 'hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    {/* Icône */}
                    <div className={`w-10 h-10 rounded-[14px] bg-gradient-to-br ${item.color} flex items-center justify-center shrink-0 ${
                      isActive ? 'ring-1 ring-primary/30' : ''
                    }`}>
                      <item.icon size={19} className={isActive ? 'text-primary' : item.iconColor} />
                    </div>

                    {/* Texte */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-body truncate ${
                        isActive ? 'text-primary font-bold' : 'text-white font-semibold'
                      }`}>
                        {item.label}
                      </p>
                      <p className="text-[10px] text-white/25 font-body truncate mt-0.5">
                        {item.desc}
                      </p>
                    </div>

                    {/* Flèche */}
                    <ChevronRight size={16} className={`shrink-0 transition-colors ${
                      isActive ? 'text-primary/60' : 'text-white/10 group-hover:text-white/25'
                    }`} />
                  </NavLink>
                );
              })}
            </div>

            {/* Espace de sécurité en bas (safe area) */}
            <div className="h-6 shrink-0" />
          </div>
        </div>
      )}

      {/* Animations CSS inline */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

export default BottomNav;
