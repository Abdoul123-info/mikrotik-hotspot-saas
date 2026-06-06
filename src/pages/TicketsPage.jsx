import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Printer, 
  Share2, 
  CheckCircle2, 
  Clock, 
  Ticket,
  ChevronLeft,
  RefreshCw,
  Layers,
  ShieldOff,
  ShieldCheck
} from 'lucide-react';
import VoucherCard from '../components/coupons/VoucherCard';
import { useSettings } from '../contexts/SettingsContext';
import { useRouter } from '../contexts/RouterContext';
import { getHotspotUsers, blockHotspotUser } from '../api/mikrotik.real';
import { formatCurrency } from '../utils/currency';

function TicketsPage() {
  const { settings } = useSettings();
  const { activeRouter } = useRouter();
  const [vouchers, setVouchers] = useState([]);
  const [profileTab, setProfileTab] = useState('all');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTickets = async () => {
    if (!activeRouter) {
      const history = JSON.parse(localStorage.getItem('hspot_history') || '[]');
      setVouchers(history);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const realUsers = await getHotspotUsers(activeRouter);
      const history = JSON.parse(localStorage.getItem('hspot_history') || '[]');
      
      const merged = new Map();
      
      // 1. First add history (contains valid createdAt dates)
      history.forEach(v => merged.set(v.username, v));
      
      // 2. Then merge with real users from router
      realUsers.forEach(v => {
        const existing = merged.get(v.username);
        if (existing) {
          // Keep the ISO date from history if it exists
          merged.set(v.username, { ...existing, ...v, createdAt: existing.createdAt });
        } else {
          merged.set(v.username, v);
        }
      });

      const sorted = Array.from(merged.values()).sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
        return timeB - timeA;
      });

      setVouchers(sorted);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, [activeRouter]);

  const handlePrint = (voucher) => { setSelectedVoucher(voucher); setIsPrinting(true); };
  const handleShare = (voucher) => {
    const text = `🎫 Voucher Hotspot\n\n📌 Code: ${voucher.username}\n🔑 Pass: ${voucher.password}\n⏳ Durée: ${voucher.timeLimit}\n💰 Prix: ${formatCurrency(voucher.price, settings)}\n\n${settings.ticketFooter}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleUnblock = async (voucher) => {
    if (!activeRouter) return;
    setIsLoading(true);
    try {
      const res = await blockHotspotUser(activeRouter, voucher.username, false);
      if (res.success) {
        setVouchers(prev => prev.map(v => 
          v.username === voucher.username ? { ...v, disabled: false } : v
        ));
      } else {
        alert('Erreur: ' + res.error);
      }
    } catch (err) {
      console.error('Failed to unblock:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Build unique profile list with counts (sorted by count descending)
  const profileCounts = vouchers.reduce((acc, v) => {
    const p = v.profileName || v.profileId || 'Inconnu';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const profiles = Object.entries(profileCounts).sort((a, b) => b[1] - a[1]);

  // Filter pipeline: profile tab → status → search
  const filteredVouchers = vouchers.filter(v => {
    const vProfile = v.profileName || v.profileId || 'Inconnu';
    const matchesProfile = profileTab === 'all' || vProfile === profileTab;
    const matchesStatus = filter === 'all' 
      ? true 
      : filter === 'blocked' 
        ? v.disabled === true
        : v.status === filter;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      (v.username || '').toLowerCase().includes(q) ||
      (v.profileName || v.profileId || '').toLowerCase().includes(q) ||
      (v.comment || '').toLowerCase().includes(q) ||
      (v.macAddress || '').toLowerCase().includes(q) ||
      (v.address || '').toLowerCase().includes(q);
    return matchesProfile && matchesStatus && matchesSearch;
  });

  const isFiltering = search.trim() !== '' || filter !== 'all' || profileTab !== 'all';

  // ── Print view ──────────────────────────────────────────────────
  if (isPrinting && selectedVoucher) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center p-8 overflow-y-auto">
        <div className="mb-8 no-print flex gap-4 w-full max-w-[80mm]">
          <button onClick={() => setIsPrinting(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg font-bold flex items-center justify-center gap-2">
            <ChevronLeft size={18} /> Retour
          </button>
          <button onClick={() => window.print()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2">
            <Printer size={18} /> Imprimer
          </button>
        </div>
        <div id="thermal-print-container" className="w-[80mm] p-4 bg-white text-black border border-gray-200 shadow-xl font-mono text-xs flex flex-col items-center text-center">
          {settings.logoBase64 && <img src={settings.logoBase64} alt="Logo" className="w-16 h-16 mb-2 object-contain" />}
          <h2 className="text-lg font-black uppercase mb-1">{settings.appName}</h2>
          <p className="mb-0.5">{settings.businessName}</p>
          <p className="mb-4 text-[10px] opacity-60">{settings.businessAddress}</p>
          <div className="w-full border-t border-dashed border-black/20 my-2" />
          <h3 className="text-sm font-black uppercase mb-1">{selectedVoucher.profileName}</h3>
          <p className="mb-0.5 text-[10px]">Durée: {selectedVoucher.timeLimit}</p>
          <p className="mb-4 text-[10px]">Données: {selectedVoucher.dataLimit}</p>
          <div className="bg-black/5 p-4 rounded-lg w-full space-y-2 mb-4 border border-black/10">
            <div className="flex justify-between items-center">
              <span className="uppercase text-[9px] font-bold">Identifiant</span>
              <span className="text-lg font-black tracking-widest">{selectedVoucher.username}</span>
            </div>
            <div className="flex justify-between items-center border-t border-black/5 pt-1">
              <span className="uppercase text-[9px] font-bold">Code / Pass</span>
              <span className="text-lg font-black tracking-widest">{selectedVoucher.password}</span>
            </div>
          </div>
          <p className="text-lg font-black mb-4">PRIX: {formatCurrency(selectedVoucher.price, settings)}</p>
          <div className="w-full border-t border-dashed border-black/20 my-2" />
          <p className="text-[10px] leading-relaxed mb-4 italic">"{settings.ticketFooter}"</p>
          <div className="flex flex-col items-center gap-1 opacity-40 text-[8px]">
            <p>Généré le: {new Date(selectedVoucher.createdAt).toLocaleString()}</p>
            <p>ID: {selectedVoucher.id}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-1000">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white">Tickets &amp; Historique</h1>
          <p className="text-white/40 font-body">Consultez, imprimez ou partagez vos coupons déjà générés.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTickets}
            title="Actualiser"
            className="h-12 px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/60 hover:text-white transition-all text-sm font-bold uppercase"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <button className="btn-primary flex items-center gap-2 w-fit h-12">
            <Printer size={18} />
            <span className="hidden sm:inline">Tout Imprimer</span>
          </button>
        </div>
      </header>

      {/* ── Profile Category Tabs ── */}
      <div className="glass-card p-4">
        <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-3 flex items-center gap-2">
          <Layers size={12} /> Catégories par profil
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* "Tous" tab */}
          <button
            onClick={() => setProfileTab('all')}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-bold whitespace-nowrap ${
              profileTab === 'all'
                ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Ticket size={14} />
            Tous
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${profileTab === 'all' ? 'bg-black/20' : 'bg-white/10'}`}>
              {vouchers.length}
            </span>
          </button>

          {/* Dynamic profile tabs */}
          {profiles.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setProfileTab(name)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-bold whitespace-nowrap ${
                profileTab === name
                  ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {name}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${profileTab === name ? 'bg-black/20' : 'bg-white/10'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Search + Status Filter ── */}
      <div className="glass-card p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Rechercher par identifiant, profil, commentaire..."
              className="bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-all w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            {[
              { id: 'all', label: 'Tous', icon: Ticket },
              { id: 'unused', label: 'Disponibles', icon: CheckCircle2 },
              { id: 'used', label: 'Utilisés', icon: Clock },
              { id: 'blocked', label: 'Bloqués', icon: ShieldOff },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all whitespace-nowrap text-sm font-bold uppercase tracking-tight flex-1 justify-center lg:flex-none ${
                  filter === f.id
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                <f.icon size={14} />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Result count ── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">
          {isFiltering
            ? `${filteredVouchers.length} résultat(s)`
            : `${filteredVouchers.length} tickets${filteredVouchers.length > 100 ? ' (affichage: 100)' : ''}`
          }
        </p>
        {profileTab !== 'all' && (
          <p className="text-[10px] text-primary/60 uppercase font-black tracking-widest">
            Profil : {profileTab}
          </p>
        )}
      </div>

      {/* ── Ticket Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          <div className="col-span-full py-20 flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-primary" size={32} />
            <p className="text-white/40 uppercase text-xs font-bold tracking-widest">Synchronisation avec MikroTik...</p>
          </div>
        ) : (
          (isFiltering ? filteredVouchers : filteredVouchers.slice(0, 100)).map(v => (
            <VoucherCard 
              key={v.id} 
              voucher={v} 
              onPrint={handlePrint} 
              onShare={handleShare}
              onUnblock={handleUnblock}
            />
          ))
        )}

        {!isLoading && filteredVouchers.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-white/10">
              <Ticket size={48} />
            </div>
            <div>
              <p className="font-heading font-extrabold uppercase text-white/40">Aucun ticket trouvé</p>
              <p className="text-sm text-white/20">Essayez de modifier vos filtres ou de générer de nouveaux coupons.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TicketsPage;
