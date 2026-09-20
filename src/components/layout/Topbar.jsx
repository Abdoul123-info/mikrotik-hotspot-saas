import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  ChevronDown, 
  Moon, 
  Sun, 
  User, 
  Wifi, 
  RefreshCw,
  LogOut
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useRouter } from '../../contexts/RouterContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function Topbar() {
  const { settings, toggleDarkMode } = useSettings();
  const { routers, activeRouter, setActiveRouterId } = useRouter();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isRouterDropdownOpen, setIsRouterDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <header className="h-14 sm:h-16 md:h-18 bg-[#07090D]/80 backdrop-blur-xl border-b border-white/5 px-3 sm:px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 transition-all">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        <div className="relative hidden lg:block w-full max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:border-primary transition-all text-xs"
          />
        </div>
        
        {/* Router Selector */}
        <div className="relative shrink-0">
          <button 
            onClick={() => setIsRouterDropdownOpen(!isRouterDropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            <div className={`w-2 h-2 rounded-full ${activeRouter?.status === 'online' ? 'bg-primary' : 'bg-red-500'} animate-pulse shrink-0`} />
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider max-w-[110px] sm:max-w-none truncate">{activeRouter?.name || 'Aucun Routeur'}</span>
            <ChevronDown size={13} className={`text-white/40 transition-transform ${isRouterDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isRouterDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsRouterDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-2 w-64 bg-[#0F1219] border border-white/10 rounded-2xl p-2 z-20 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] uppercase font-bold text-white/20 px-3 py-2 tracking-widest">Mes Équipements</p>
                <div className="space-y-1">
                  {routers.map((router) => (
                    <button
                      key={router.id}
                      onClick={() => {
                        setActiveRouterId(router.id);
                        setIsRouterDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all ${
                        activeRouter?.id === router.id ? 'bg-primary/10 text-primary' : 'hover:bg-white/5 text-white/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-left">
                        <Wifi size={14} className={activeRouter?.id === router.id ? 'text-primary' : 'text-white/40'} />
                        <div>
                          <p className="text-xs font-bold">{router.name}</p>
                          <p className="text-[10px] text-white/30">{router.ip}</p>
                        </div>
                      </div>
                      {activeRouter?.id === router.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/5 mt-2 pt-2 text-center">
                  <button className="text-[10px] uppercase font-bold text-primary hover:underline p-1.5 tracking-widest flex items-center justify-center gap-1.5 w-full">
                    <RefreshCw size={10} /> Actualiser
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
        <button 
          onClick={toggleDarkMode}
          className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all"
        >
          {settings.darkMode ? <Sun size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px]" />}
        </button>

        <button className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all relative">
          <Bell size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-[#07090D]" />
        </button>

        <div className="h-6 sm:h-8 w-px bg-white/5 mx-1 hidden sm:block" />

        <div className="relative">
          <div 
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="flex items-center gap-2.5 ml-1 sm:ml-2 group cursor-pointer"
          >
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold leading-none">{currentUser?.email?.split('@')[0] || 'Utilisateur'}</p>
              <p className="text-[9px] text-white/40 uppercase mt-0.5">SaaS Gérant</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-white/10 group-hover:border-primary/40 transition-all">
              <User size={16} className="text-primary" />
            </div>
          </div>

          {isUserDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsUserDropdownOpen(false)} />
              <div className="absolute top-full right-0 mt-2 w-56 bg-[#0F1219] border border-white/10 rounded-2xl p-2 z-20 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 border-b border-white/5 mb-1">
                  <p className="text-xs font-bold text-white truncate">{currentUser?.email}</p>
                  <p className="text-[10px] text-white/40 uppercase mt-0.5 tracking-wider">Compte Client</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-all text-xs"
                >
                  <LogOut size={15} />
                  <span className="font-medium">Déconnexion</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
