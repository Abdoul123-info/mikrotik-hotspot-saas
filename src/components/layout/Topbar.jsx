import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  ChevronDown, 
  Moon, 
  Sun, 
  User, 
  Wifi, 
  RefreshCw 
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useRouter } from '../../contexts/RouterContext';

function Topbar() {
  const { settings, toggleDarkMode } = useSettings();
  const { routers, activeRouter, setActiveRouterId } = useRouter();
  const [isRouterDropdownOpen, setIsRouterDropdownOpen] = useState(false);

  return (
    <header className="h-20 bg-bg-dark/40 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative hidden lg:block w-full max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-primary transition-all text-sm"
          />
        </div>
        
        {/* Router Selector */}
        <div className="relative">
          <button 
            onClick={() => setIsRouterDropdownOpen(!isRouterDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            <div className={`w-2 h-2 rounded-full ${activeRouter?.status === 'online' ? 'bg-primary' : 'bg-red-500'} animate-pulse`} />
            <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">{activeRouter?.name || 'Aucun Routeur'}</span>
            <ChevronDown size={14} className={`text-white/40 transition-transform ${isRouterDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isRouterDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsRouterDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-2 w-64 glass-card p-2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
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
                        activeRouter?.id === router.id ? 'bg-primary/10 text-primary' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-left">
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
                  <button className="text-[10px] uppercase font-bold text-primary hover:underline p-2 tracking-widest flex items-center justify-center gap-2 w-full">
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
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-bg-dark" />
        </button>

        <div className="h-10 w-px bg-white/5 mx-2 hidden sm:block" />

        <div className="flex items-center gap-3 ml-2 group cursor-pointer">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold leading-none">Administrateur</p>
            <p className="text-[10px] text-white/40 uppercase mt-1">Gérant</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-white/10 group-hover:border-primary/40 transition-all">
            <User size={20} className="text-primary" />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
