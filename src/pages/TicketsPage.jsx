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

  // Print Settings
  const [printingVouchers, setPrintingVouchers] = useState([]);
  const [printLayout, setPrintLayout] = useState('grid'); // 'grid' or 'thermal'
  const [ticketStyle, setTicketStyle] = useState('classic'); // 'classic', 'qr', 'detailed'
  const [printColumns, setPrintColumns] = useState(4);
  const [printWifiName, setPrintWifiName] = useState('WIFI ZONE');
  const [printFooter, setPrintFooter] = useState('Merci de votre visite !');

  useEffect(() => {
    if (settings) {
      setPrintWifiName(settings.appName || 'WIFI ZONE');
      setPrintFooter(settings.ticketFooter || 'Merci de votre visite !');
    }
  }, [settings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('print-last-batch') === 'true') {
      const saved = localStorage.getItem('last_batch_info');
      if (saved) {
        try {
          const batch = JSON.parse(saved);
          if (batch && batch.vouchers && batch.vouchers.length > 0) {
            setPrintingVouchers(batch.vouchers);
            setPrintLayout('grid');
            
            const style = params.get('style');
            if (style) setTicketStyle(style);
            else setTicketStyle('classic');
            
            setIsPrinting(true);
            
            // Clean url search params without reload
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (e) {
          console.error('Failed to parse last batch vouchers:', e);
        }
      }
    }
  }, [vouchers]);

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

  const handlePrint = (voucher) => { 
    setSelectedVoucher(voucher); 
    setPrintingVouchers([voucher]);
    setPrintLayout('thermal');
    setIsPrinting(true); 
  };
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
  if (isPrinting && printingVouchers.length > 0) {
    return (
      <div className="fixed inset-0 z-[200] bg-gray-50 dark:bg-bg-dark flex flex-col items-center p-4 md:p-8 overflow-y-auto">
        {/* Print Configuration Panel (hidden on print) */}
        <div className="mb-8 no-print w-full max-w-4xl bg-white dark:bg-white/[0.03] backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-heading font-black text-gray-900 dark:text-white uppercase tracking-tight">Configuration de l'Impression</h3>
              <p className="text-gray-500 dark:text-white/40 text-xs">Personnalisez le format et le modèle de vos tickets avant d'imprimer.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsPrinting(false)} 
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-xl font-bold flex items-center gap-2 text-xs uppercase tracking-wider transition-all"
              >
                <ChevronLeft size={16} /> Retour
              </button>
              <button 
                onClick={() => window.print()} 
                className="px-5 py-2.5 bg-primary text-bg-dark hover:bg-primary/90 rounded-xl font-black flex items-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-primary/20 transition-all"
              >
                <Printer size={16} /> Lancer l'Impression
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Format de page */}
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-black text-gray-400 dark:text-white/30 tracking-widest">Format de page</label>
              <select 
                value={printLayout} 
                onChange={(e) => setPrintLayout(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white p-3 rounded-xl text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="grid" className="bg-white dark:bg-bg-dark">Grille A4 (Masse)</option>
                <option value="thermal" className="bg-white dark:bg-bg-dark">Ticket Unique (Thermique 80mm)</option>
              </select>
            </div>

            {/* Modèle de ticket */}
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-black text-gray-400 dark:text-white/30 tracking-widest">Modèle de Ticket</label>
              <select 
                value={ticketStyle} 
                onChange={(e) => setTicketStyle(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white p-3 rounded-xl text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="classic" className="bg-white dark:bg-bg-dark">Classique Mikhmon</option>
                <option value="qr" className="bg-white dark:bg-bg-dark">Avec Code QR (Scan)</option>
                <option value="detailed" className="bg-white dark:bg-bg-dark">Détaillé (Notice)</option>
              </select>
            </div>

            {/* Nombre de colonnes */}
            {printLayout === 'grid' && (
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-black text-gray-400 dark:text-white/30 tracking-widest">Colonnes par ligne</label>
                <select 
                  value={printColumns} 
                  onChange={(e) => setPrintColumns(parseInt(e.target.value))}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white p-3 rounded-xl text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="2" className="bg-white dark:bg-bg-dark">2 Colonnes</option>
                  <option value="3" className="bg-white dark:bg-bg-dark">3 Colonnes</option>
                  <option value="4" className="bg-white dark:bg-bg-dark">4 Colonnes (Recommandé)</option>
                  <option value="5" className="bg-white dark:bg-bg-dark">5 Colonnes</option>
                  <option value="6" className="bg-white dark:bg-bg-dark">6 Colonnes</option>
                </select>
              </div>
            )}

            {/* Titre Wi-Fi */}
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-black text-gray-400 dark:text-white/30 tracking-widest">Titre du Wi-Fi</label>
              <input 
                type="text" 
                value={printWifiName} 
                onChange={(e) => setPrintWifiName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white p-3 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Espace d'Impression */}
        <div className="w-full max-w-4xl bg-white text-black p-4 rounded-2xl shadow-inner border border-gray-200 min-h-[500px]">
          {printLayout === 'thermal' ? (
            /* Thermal Container */
            <div id="thermal-print-container" className="w-[80mm] p-4 mx-auto bg-white text-black border border-gray-200 shadow-xl font-mono text-xs flex flex-col items-center text-center">
              {printingVouchers.map((v, idx) => (
                <React.Fragment key={v.id || idx}>
                  {idx > 0 && <div className="w-full border-t border-dashed border-black/20 my-8" style={{ pageBreakBefore: 'always' }} />}
                  {settings.logoBase64 && <img src={settings.logoBase64} alt="Logo" className="w-16 h-16 mb-2 object-contain" />}
                  <h2 className="text-lg font-black uppercase mb-1">{printWifiName}</h2>
                  <p className="mb-0.5">{settings.businessName}</p>
                  <p className="mb-4 text-[10px] opacity-60">{settings.businessAddress}</p>
                  <div className="w-full border-t border-dashed border-black/20 my-2" />
                  <h3 className="text-sm font-black uppercase mb-1">{v.profileName}</h3>
                  <p className="mb-0.5 text-[10px]">Durée: {v.timeLimit}</p>
                  <p className="mb-4 text-[10px]">Données: {v.dataLimit}</p>
                  <div className="bg-black/5 p-4 rounded-lg w-full space-y-2 mb-4 border border-black/10">
                    <div className="flex justify-between items-center">
                      <span className="uppercase text-[9px] font-bold">Identifiant</span>
                      <span className="text-lg font-black tracking-widest">{v.username}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-black/5 pt-1">
                      <span className="uppercase text-[9px] font-bold">Code / Pass</span>
                      <span className="text-lg font-black tracking-widest">{v.password}</span>
                    </div>
                  </div>
                  <p className="text-lg font-black mb-4">PRIX: {formatCurrency(v.price, settings)}</p>
                  <div className="w-full border-t border-dashed border-black/20 my-2" />
                  <p className="text-[10px] leading-relaxed mb-4 italic">"{printFooter}"</p>
                  <div className="flex flex-col items-center gap-1 opacity-40 text-[8px]">
                    <p>Généré le: {v.createdAt ? new Date(v.createdAt).toLocaleString() : new Date().toLocaleString()}</p>
                    <p>ID: {v.id}</p>
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            /* Grid Container (A4 layout style Mikhmon) */
            <div 
              id="grid-print-container" 
              className="w-full bg-white text-black p-2 mx-auto"
              style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${printColumns}, minmax(0, 1fr))`,
                gap: '8px' 
              }}
            >
              {printingVouchers.map((v, index) => (
                <div 
                  key={v.id || index} 
                  className="border border-black border-dashed p-3 rounded flex flex-col justify-between bg-white text-black text-center font-mono text-[11px] relative"
                  style={{ minHeight: '90px', pageBreakInside: 'avoid' }}
                >
                  {/* Header */}
                  <div className="font-sans font-bold text-center border-b border-black/10 pb-1 mb-1 flex items-center justify-center gap-1">
                    {settings.logoBase64 && ticketStyle === 'detailed' && <img src={settings.logoBase64} className="w-3.5 h-3.5 object-contain" alt="" />}
                    <span className="uppercase text-[8px] tracking-wide font-black">{printWifiName}</span>
                  </div>

                  {/* Body */}
                  {ticketStyle === 'qr' ? (
                    <div className="flex items-center justify-between gap-1 my-1">
                      <div className="text-left flex-1 space-y-1">
                        {v.username === v.password ? (
                          <div>
                            <p className="text-[7px] uppercase opacity-60">Code</p>
                            <p className="font-bold text-sm tracking-wider">{v.username}</p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div>
                              <span className="text-[7px] uppercase opacity-60">User: </span>
                              <span className="font-bold">{v.username}</span>
                            </div>
                            <div>
                              <span className="text-[7px] uppercase opacity-60">Pass: </span>
                              <span className="font-bold">{v.password}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${encodeURIComponent(v.username)}`} 
                        alt="QR" 
                        className="w-10 h-10 object-contain border border-black/10" 
                      />
                    </div>
                  ) : ticketStyle === 'detailed' ? (
                    <div className="my-1 space-y-1">
                      {v.username === v.password ? (
                        <div className="bg-black/5 p-1 rounded border border-black/10">
                          <p className="text-[7px] uppercase opacity-60">Code de Connexion</p>
                          <p className="font-bold text-base tracking-widest">{v.username}</p>
                        </div>
                      ) : (
                        <div className="bg-black/5 p-1 rounded border border-black/10 grid grid-cols-2 gap-0.5">
                          <div>
                            <p className="text-[7px] uppercase opacity-60 font-black">User</p>
                            <p className="font-bold text-xs tracking-wider">{v.username}</p>
                          </div>
                          <div className="border-l border-black/10">
                            <p className="text-[7px] uppercase opacity-60 font-black">Pass</p>
                            <p className="font-bold text-xs tracking-wider">{v.password}</p>
                          </div>
                        </div>
                      )}
                      <p className="text-[7px] opacity-60 leading-tight">1. Connexion au Wi-Fi. 2. Entrez le code dans le navigateur.</p>
                    </div>
                  ) : (
                    /* Classic Mikhmon style */
                    <div className="my-2 text-center">
                      {v.username === v.password ? (
                        <div className="bg-black/5 py-1 px-2 rounded border border-black/10 font-bold text-sm tracking-widest inline-block w-full">
                          {v.username}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          <div className="bg-black/5 p-1 rounded border border-black/10">
                            <p className="text-[7px] uppercase opacity-50 font-bold">User</p>
                            <p className="font-bold tracking-wider">{v.username}</p>
                          </div>
                          <div className="bg-black/5 p-1 rounded border border-black/10">
                            <p className="text-[7px] uppercase opacity-50 font-bold">Pass</p>
                            <p className="font-bold tracking-wider">{v.password}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="border-t border-black/10 pt-1 mt-1 flex justify-between items-center text-[9px] font-bold">
                    <span>{v.timeLimit || 'Illimité'}</span>
                    <span className="text-[10px] font-black">{formatCurrency(v.price, settings)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
          <button 
            onClick={() => {
              setPrintingVouchers(filteredVouchers);
              setPrintLayout('grid');
              setIsPrinting(true);
            }}
            disabled={filteredVouchers.length === 0}
            className="btn-primary flex items-center gap-2 w-fit h-12 disabled:opacity-50 disabled:cursor-not-allowed"
          >
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
