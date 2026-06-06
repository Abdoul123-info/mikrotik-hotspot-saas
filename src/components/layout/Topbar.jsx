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
    <header className="h-20 bg-[#07090D]/40 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative hidden lg:block w-full max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition-all text-sm"
          />
        </div>
        
        {/* Router Selector */}
        <div className="relative">
          <button 
            onClick={() => setIsRouterDropdownOpen(!isRouterDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            <div className={`w-2 h-2 rounded-full ${activeRouter?.status === 'online' ? 'bg-blue-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">{activeRouter?.name || 'Aucun Routeur'}</span>
            <ChevronDown size={14} className={`text-white/40 transition-transform ${isRouterDropdownOpen ? 'rotate-180' : ''}`} />
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
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                        activeRouter?.id === router.id ? 'bg-blue-500/10 text-blue-500' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-left">
                        <Wifi size={14} className={activeRouter?.id === router.id ? 'text-blue-500' : 'text-white/40'} />
                        <div>
                          <p className="text-xs font-bold">{router.name}</p>
                          <p className="text-[10px] text-white/30">{router.ip}</p>
                        </div>
                      </div>
                      {activeRouter?.id === router.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/5 mt-2 pt-2 text-center">
                  <button className="text-[10px] uppercase font-bold text-blue-500 hover:underline p-2 tracking-widest flex items-center justify-center gap-2 w-full">
                    <RefreshCw size={10} /> Actualiser
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile Search Toggle */}
        <button className="lg:hidden p-2.5 text-white/40 hover:text-white transition-colors">
          <Search size={20} />
        </button>

        <button 
          onClick={toggleDarkMode}
          className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all"
        >
          {settings.darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#07090D]" />
        </button>

        <div className="h-10 w-px bg-white/5 mx-2 hidden sm:block" />

        <div className="relative">
          <div 
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="flex items-center gap-3 ml-2 group cursor-pointer"
          >
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold leading-none">{currentUser?.email?.split('@')[0] || 'Utilisateur'}</p>
              <p className="text-[10px] text-white/40 uppercase mt-1">SaaS Gérant</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center border border-white/10 group-hover:border-blue-500/40 transition-all">
              <User size={20} className="text-blue-500" />
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
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-red-400 transition-all"
                >
                  <LogOut size={16} />
                  <span className="text-sm font-medium">Déconnexion</span>
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
