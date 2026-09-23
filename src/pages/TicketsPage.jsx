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
  ShieldCheck,
  Trash2,
  FileText,
  CheckSquare,
  AlertOctagon,
  X
} from 'lucide-react';
import VoucherCard from '../components/coupons/VoucherCard';
import { useSettings } from '../contexts/SettingsContext';
import { useRouter } from '../contexts/RouterContext';
import { 
  getHotspotUsers, 
  blockHotspotUser,
  deleteHotspotUser,
  deleteHotspotUsersBatch
} from '../api/mikrotik.real';
import { formatCurrency } from '../utils/currency';
import { parseTicketDate } from '../utils/sales';

function TicketsPage() {
  const { settings } = useSettings();
  const { activeRouter } = useRouter();
  const [vouchers, setVouchers] = useState([]);
  const [profileTab, setProfileTab] = useState('all');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Selection & Bulk Operations State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedUsernames, setSelectedUsernames] = useState(new Set());
  const [voucherToDelete, setVoucherToDelete] = useState(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
            
            if (params.get('pdf') === 'true') {
              setTimeout(() => {
                const originalTitle = document.title;
                document.title = `Tickets_${(settings?.appName || 'Hotspot').replace(/\s+/g, '_')}_${batch.code || 'Batch'}`;
                window.print();
                setTimeout(() => { document.title = originalTitle; }, 1000);
              }, 400);
            }
            
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
      setVouchers([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const realUsers = await getHotspotUsers(activeRouter);
      const history = JSON.parse(localStorage.getItem(`hspot_history_${activeRouter.id}`) || '[]');
      
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
        const dateA = parseTicketDate({ comment: a.comment || a.createdAt }) || new Date(a.createdAt);
        const dateB = parseTicketDate({ comment: b.comment || b.createdAt }) || new Date(b.createdAt);
        const timeA = (dateA && !isNaN(dateA.getTime())) ? dateA.getTime() : 0;
        const timeB = (dateB && !isNaN(dateB.getTime())) ? dateB.getTime() : 0;
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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleSelectVoucher = (voucher) => {
    setSelectedUsernames(prev => {
      const next = new Set(prev);
      if (next.has(voucher.username)) {
        next.delete(voucher.username);
      } else {
        next.add(voucher.username);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedUsernames(new Set(filteredVouchers.map(v => v.username)));
  };

  const deselectAll = () => {
    setSelectedUsernames(new Set());
  };

  const handleConfirmDeleteSingle = async () => {
    if (!activeRouter || !voucherToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteHotspotUser(activeRouter, voucherToDelete.username, voucherToDelete.id);
      if (res.success) {
        setVouchers(prev => prev.filter(v => v.username !== voucherToDelete.username && v.id !== voucherToDelete.id));
        showToast(`Coupon ${voucherToDelete.username} supprimé avec succès.`);
        setVoucherToDelete(null);
      } else {
        showToast(res.error || 'Erreur lors de la suppression', 'error');
      }
    } catch (err) {
      showToast('Erreur: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteBulk = async () => {
    if (!activeRouter || selectedUsernames.size === 0) return;
    setIsDeleting(true);
    const vouchersToDelete = vouchers.filter(v => selectedUsernames.has(v.username));
    try {
      const res = await deleteHotspotUsersBatch(activeRouter, vouchersToDelete);
      if (res.success) {
        setVouchers(prev => prev.filter(v => !selectedUsernames.has(v.username)));
        showToast(`${res.deletedCount || vouchersToDelete.length} coupon(s) supprimé(s) avec succès.`);
        setSelectedUsernames(new Set());
        setShowBulkDeleteModal(false);
        setIsSelectionMode(false);
      } else {
        showToast(res.error || 'Erreur lors de la suppression', 'error');
      }
    } catch (err) {
      showToast('Erreur: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
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
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={() => setIsPrinting(false)} 
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-xl font-bold flex items-center gap-2 text-xs uppercase tracking-wider transition-all"
              >
                <ChevronLeft size={16} /> Retour
              </button>
              <button 
                onClick={() => {
                  const originalTitle = document.title;
                  document.title = `Tickets_${printWifiName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
                  window.print();
                  setTimeout(() => { document.title = originalTitle; }, 1000);
                }} 
                className="px-5 py-2.5 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 rounded-xl font-black flex items-center gap-2 text-xs uppercase tracking-wider transition-all"
                title="Dans la fenêtre d'impression, choisissez 'Enregistrer au format PDF'"
              >
                <FileText size={16} /> Enregistrer en PDF
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
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedUsernames(new Set());
            }}
            className={`h-12 px-4 rounded-xl border flex items-center gap-2 text-xs font-bold uppercase transition-all ${
              isSelectionMode 
                ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20 font-black' 
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <CheckSquare size={16} />
            <span>{isSelectionMode ? 'Quitter Sélection' : 'Sélectionner'}</span>
          </button>
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
            <span className="hidden sm:inline">Tout Imprimer / PDF</span>
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

      {/* ── Result count & Display selector ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">
            {filteredVouchers.length} ticket(s) {filteredVouchers.length > displayLimit ? `(affichés : ${Math.min(displayLimit, filteredVouchers.length)})` : ''}
          </p>
          {profileTab !== 'all' && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-black uppercase tracking-wider border border-primary/30">
              Profil : {profileTab}
            </span>
          )}
        </div>

        {filteredVouchers.length > 50 && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40">
            <span>Afficher :</span>
            {[50, 100, 250, 500].map(n => (
              <button
                key={n}
                onClick={() => setDisplayLimit(n)}
                className={`px-2 py-1 rounded-lg transition-all ${
                  displayLimit === n
                    ? 'bg-primary text-black font-black shadow-md shadow-primary/20'
                    : 'bg-white/5 hover:bg-white/10 text-white/60'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setDisplayLimit(filteredVouchers.length)}
              className={`px-2 py-1 rounded-lg transition-all ${
                displayLimit >= filteredVouchers.length
                  ? 'bg-primary text-black font-black shadow-md shadow-primary/20'
                  : 'bg-white/5 hover:bg-white/10 text-white/60'
              }`}
            >
              Tous ({filteredVouchers.length})
            </button>
          </div>
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
          filteredVouchers.slice(0, displayLimit).map(v => (
            <VoucherCard 
              key={v.id} 
              voucher={v} 
              onPrint={handlePrint} 
              onShare={handleShare}
              onUnblock={handleUnblock}
              onDelete={(voucher) => setVoucherToDelete(voucher)}
              isSelectionMode={isSelectionMode}
              isSelected={selectedUsernames.has(v.username)}
              onToggleSelect={toggleSelectVoucher}
            />
          ))
        )}

        {!isLoading && filteredVouchers.length > displayLimit && (
          <div className="col-span-full flex flex-col sm:flex-row items-center justify-center gap-3 pt-6 pb-4">
            <button
              onClick={() => setDisplayLimit(prev => Math.min(prev + 100, filteredVouchers.length))}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-lg"
            >
              Afficher plus (+100)
            </button>
            <button
              onClick={() => setDisplayLimit(filteredVouchers.length)}
              className="px-6 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-xs font-black uppercase tracking-wider text-primary transition-all shadow-lg"
            >
              Tout afficher ({filteredVouchers.length} tickets)
            </button>
          </div>
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

      {/* Floating Selection Bar */}
      {isSelectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 animate-in slide-in-from-bottom-6 duration-300">
          <div className="glass-card p-4 border-primary/30 shadow-2xl flex items-center justify-between gap-3 bg-[#07090D]/95 backdrop-blur-2xl">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
                {selectedUsernames.size}
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider hidden sm:inline">
                sélectionné(s)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedUsernames.size === filteredVouchers.length && filteredVouchers.length > 0 ? (
                <button
                  onClick={deselectAll}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white/60 hover:text-white transition-all"
                >
                  Tout décocher
                </button>
              ) : (
                <button
                  onClick={selectAllFiltered}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white/60 hover:text-white transition-all"
                >
                  Tout cocher ({filteredVouchers.length})
                </button>
              )}

              <button
                onClick={() => {
                  const selectedList = vouchers.filter(v => selectedUsernames.has(v.username));
                  setPrintingVouchers(selectedList);
                  setPrintLayout('grid');
                  setIsPrinting(true);
                }}
                disabled={selectedUsernames.size === 0}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-all"
                title="Imprimer ou enregistrer en PDF"
              >
                <Printer size={14} />
                <span className="hidden md:inline">Imprimer / PDF</span>
              </button>

              <button
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={selectedUsernames.size === 0}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-red-500/20 transition-all"
              >
                <Trash2 size={14} />
                <span>Supprimer ({selectedUsernames.size})</span>
              </button>

              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedUsernames(new Set());
                }}
                className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                title="Fermer la sélection"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression Unique */}
      {voucherToDelete && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-card max-w-sm w-full p-6 border-red-500/30 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-heading font-black text-white uppercase tracking-tight">Supprimer le coupon ?</h3>
                <p className="text-xs text-white/40">Action irréversible</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase font-bold text-[10px]">Identifiant</span>
                <span className="text-primary font-mono font-bold text-sm">{voucherToDelete.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase font-bold text-[10px]">Profil</span>
                <span className="text-white font-bold">{voucherToDelete.profileName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase font-bold text-[10px]">Prix</span>
                <span className="text-white font-mono font-bold">{formatCurrency(voucherToDelete.price, settings)}</span>
              </div>
            </div>

            <p className="text-xs text-red-300/80 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl leading-relaxed">
              Ce coupon ne pourra plus être utilisé pour se connecter au réseau.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setVoucherToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl border border-white/10 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {isDeleting ? 'En cours...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression Groupée */}
      {showBulkDeleteModal && selectedUsernames.size > 0 && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-card max-w-md w-full p-6 border-red-500/30 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
                <AlertOctagon size={28} />
              </div>
              <div>
                <h3 className="text-lg font-heading font-black text-white uppercase tracking-tight">Supprimer la sélection ?</h3>
                <p className="text-xs text-white/40">Action groupée irréversible</p>
              </div>
            </div>

            <p className="text-xs text-red-300/80 bg-red-500/10 border border-red-500/20 p-3 rounded-xl leading-relaxed">
              ⚠️ Vous êtes sur le point de supprimer définitivement <strong className="text-white font-black">{selectedUsernames.size} coupon(s)</strong> de votre routeur MikroTik ({activeRouter?.name}).
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBulk}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {isDeleting ? 'Suppression...' : `Supprimer (${selectedUsernames.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[350] px-4 py-3 rounded-xl bg-[#0A0C10] border border-primary/30 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-4">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default TicketsPage;
