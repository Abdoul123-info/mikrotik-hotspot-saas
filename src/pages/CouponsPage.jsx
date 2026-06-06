import React, { useState, useEffect } from 'react';
import { 
  Plus, RefreshCw, Hash, Type, Ruler, KeyRound, 
  Server, Shield, Timer, Database, MessageSquare,
  LayoutGrid, List, CheckCircle2, AlertTriangle,
  Printer, QrCode, FileDown, Activity, ChevronRight,
  Zap, Info
} from 'lucide-react';
import { 
  getVoucherProfiles, 
  generateVouchers, 
  getHotspotServers 
} from '../api/mikrotik.real';
import { useSettings } from '../contexts/SettingsContext';
import { useRouter } from '../contexts/RouterContext';
import { formatCurrency } from '../utils/currency';
import { useNavigate } from 'react-router-dom';

const USER_MODES = [
  { id: 'up', label: 'User & Pass', icon: KeyRound },
  { id: 'u=p', label: 'User = Pass', icon: Type },
];

const CHARACTER_SETS = [
  { id: 'mixed', label: 'Alphanumérique (A1b2)', desc: 'Lettres et chiffres' },
  { id: 'uppercase', label: 'Majuscules (ABCD)', desc: 'Lettres capitales' },
  { id: 'lowercase', label: 'Minuscules (abcd)', desc: 'Lettres minuscules' },
  { id: 'numeric', label: 'Numérique (1234)', desc: 'Chiffres uniquement' },
];

function CouponsPage() {
  const { settings } = useSettings();
  const { activeRouter } = useRouter();
  const navigate = useNavigate();
  
  const [profiles, setProfiles] = useState([]);
  const [servers, setServers] = useState([{ id: 'all', name: 'all' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Form State
  const [qty, setQty] = useState(10);
  const [server, setServer] = useState('all');
  const [userMode, setUserMode] = useState('up');
  const [nameLength, setNameLength] = useState(6);
  const [prefix, setPrefix] = useState('');
  const [charSet, setCharSet] = useState('mixed');
  const [profileId, setProfileId] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [dataLimit, setDataLimit] = useState('');
  const [comment, setComment] = useState('');
  
  // Last Generation Info (Local persistence for this session)
  const [lastBatch, setLastBatch] = useState(() => {
    const saved = localStorage.getItem('last_batch_info');
    return saved ? JSON.parse(saved) : null;
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (activeRouter) {
      loadInitialData();
    }
  }, [activeRouter]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [pData, sData] = await Promise.all([
        getVoucherProfiles(activeRouter),
        getHotspotServers(activeRouter)
      ]);
      
      const customProfiles = pData.filter(p => !p.isDefault);
      setProfiles(customProfiles);
      setServers(sData);
      
      if (customProfiles.length > 0) {
        setProfileId(customProfiles[0].id);
      }
    } catch (err) {
      showToast('Erreur de chargement: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activeRouter || !profileId) return;
    setShowPreview(true);
  };

  const handleConfirmGenerate = async () => {
    setShowPreview(false);
    setIsGenerating(true);
    const selectedProfile = profiles.find(p => p.id === profileId);

    try {
      const options = {
        qty: parseInt(qty),
        server,
        userMode,
        length: nameLength,
        prefix: prefix.trim(),
        characterSet: charSet,
        timeLimit: timeLimit || selectedProfile?.timeLimit,
        dataLimit: dataLimit ? `${dataLimit}M` : selectedProfile?.dataLimit,
        mikhmonCompat: true,
        logSales: true
      };

      const result = await generateVouchers(activeRouter, selectedProfile, qty, options);
      
      if (result && result.length > 0) {
        const batchInfo = {
          count: result.length,
          profileName: selectedProfile.name,
          price: selectedProfile.price,
          totalPrice: selectedProfile.price * result.length,
          date: new Date().toLocaleString(),
          code: Math.floor(Math.random() * 999).toString().padStart(3, '0'),
          vouchers: result
        };
        setLastBatch(batchInfo);
        localStorage.setItem('last_batch_info', JSON.stringify(batchInfo));
        showToast(`${result.length} coupons générés avec succès !`);
        
        // Wait a bit to let the user see the success toast before navigating
        setTimeout(() => {
          navigate('/tickets');
        }, 1500);
      }
    } catch (err) {
      showToast('Erreur de génération: ' + err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedProfile = profiles.find(p => p.id === profileId);
  const totalVal = (selectedProfile?.price || 0) * qty;

  const getPreviewCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = prefix;
    for (let i = 0; i < nameLength; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl animate-in slide-in-from-right duration-500 ${
          toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-primary/10 border-primary/30 text-primary'
        }`}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card max-w-lg w-full p-8 space-y-6 border-primary/20 shadow-2xl shadow-primary/10">
            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Activity size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-heading font-black text-white uppercase tracking-tight">Confirmer la Génération</h3>
                <p className="text-white/40 text-xs">Vérifiez les détails avant l'envoi au routeur.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[9px] uppercase font-black text-white/30 tracking-widest mb-1">Quantité</p>
                <p className="text-lg font-bold text-white">{qty} coupons</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[9px] uppercase font-black text-white/30 tracking-widest mb-1">Valeur Totale</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(totalVal, settings)}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[9px] uppercase font-black text-white/30 tracking-widest mb-1">Profil</p>
                <p className="text-lg font-bold text-white truncate">{selectedProfile?.name}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[9px] uppercase font-black text-white/30 tracking-widest mb-1">Serveur</p>
                <p className="text-lg font-bold text-white uppercase">{server}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[9px] uppercase font-black text-white/30 tracking-widest">Exemples de codes</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs font-mono text-primary font-bold">
                    {getPreviewCode()}{userMode === 'up' ? ' / ****' : ''}
                  </div>
                ))}
                <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white/20">
                  ... +{qty - 3} autres
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setShowPreview(false)}
                className="flex-1 h-14 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase text-white/60 hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
              <button 
                onClick={handleConfirmGenerate}
                className="flex-1 h-14 btn-primary flex items-center justify-center gap-2 text-xs font-bold uppercase"
              >
                <Plus size={16} />
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white">Générateur Avancé</h1>
          <p className="text-white/40 font-body">Configurez et générez vos coupons de masse — <span className="text-primary font-bold">{activeRouter?.name}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadInitialData} className="h-11 px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white/60 transition-all flex items-center gap-2 text-xs font-bold uppercase">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Column: Basic Params */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex items-center gap-2">
                    <Hash size={12} className="text-primary" /> Quantité
                  </label>
                  <div className="relative">
                    <input 
                      type="number" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-white/5 border border-white/10 focus:border-primary outline-none text-white p-4 rounded-xl text-xl font-black transition-all"
                    />
                    <div className="absolute right-2 top-2 flex gap-1">
                      {[10, 50, 100].map(v => (
                        <button key={v} type="button" onClick={() => setQty(v)} className="px-2 py-1 bg-white/5 hover:bg-primary/20 rounded-md text-[10px] font-bold text-white/40 hover:text-primary transition-all">
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex items-center gap-2">
                    <Server size={12} className="text-secondary" /> Serveur Hotspot
                  </label>
                  <select 
                    value={server} onChange={e => setServer(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-secondary outline-none text-white p-4 rounded-xl text-sm font-bold appearance-none cursor-pointer"
                  >
                    {servers.map(s => <option key={s.id} value={s.name} className="bg-[#0f1115]">{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex items-center gap-2">
                    <Shield size={12} className="text-accent" /> Mode Utilisateur
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {USER_MODES.map(m => (
                      <button 
                        key={m.id} type="button" onClick={() => setUserMode(m.id)}
                        className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                          userMode === m.id ? 'bg-accent/20 border-accent text-accent' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        <m.icon size={16} />
                        <span className="text-xs font-bold uppercase">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex items-center gap-2">
                    <Type size={12} className="text-primary" /> Jeu de caractères
                  </label>
                  <select 
                    value={charSet} onChange={e => setCharSet(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-primary outline-none text-white p-4 rounded-xl text-sm font-bold appearance-none cursor-pointer"
                  >
                    {CHARACTER_SETS.map(c => <option key={c.id} value={c.id} className="bg-[#0f1115]">{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Right Column: Advanced/Overrides */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Longueur Nom</label>
                    <input 
                      type="number" min="3" max="12" value={nameLength} onChange={e => setNameLength(parseInt(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl text-white font-bold text-center"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Préfixe</label>
                    <input 
                      type="text" placeholder="ex: WIFI-" value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())}
                      className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl text-white font-bold text-center placeholder:text-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex items-center gap-2">
                    <LayoutGrid size={12} className="text-primary" /> Profil à utiliser
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                    {profiles.map(p => (
                      <button 
                        key={p.id} type="button" onClick={() => setProfileId(p.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          profileId === p.id ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="text-xs font-bold text-white">{p.name}</span>
                        <span className="text-[10px] font-mono text-primary">{p.price > 0 ? formatCurrency(p.price, settings) : 'Gratuit'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex items-center gap-2">
                    <Timer size={12} className="text-secondary" /> Limite de Temps (Optionnel)
                  </label>
                  <input 
                    type="text" placeholder="ex: 1h, 1d, 30m" value={timeLimit} onChange={e => setTimeLimit(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl text-white font-bold placeholder:text-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex items-center gap-2">
                    <Database size={12} className="text-accent" /> Limite de Données (MB)
                  </label>
                  <input 
                    type="number" placeholder="ex: 500" value={dataLimit} onChange={e => setDataLimit(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl text-white font-bold placeholder:text-white/10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex items-center gap-2">
                <MessageSquare size={12} className="text-white/40" /> Commentaire
              </label>
              <input 
                type="text" placeholder="Note pour ces coupons..." value={comment} onChange={e => setComment(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white font-bold placeholder:text-white/10"
              />
            </div>

            <div className="pt-4 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 w-full p-6 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                <div>
                  <p className="text-[9px] uppercase font-black text-white/30 tracking-widest mb-1">Valeur Totale</p>
                  <p className="text-2xl font-black text-primary font-mono">{formatCurrency(totalVal, settings)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase font-black text-white/30 tracking-widest mb-1">Prix Unitaire</p>
                  <p className="text-sm font-bold text-white/60">{formatCurrency(selectedProfile?.price || 0, settings)}</p>
                </div>
              </div>
              <button 
                type="submit" disabled={isGenerating || !profileId}
                className={`w-full md:w-fit h-20 px-10 btn-primary flex items-center justify-center gap-3 text-lg font-black uppercase tracking-tighter ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isGenerating ? <RefreshCw className="animate-spin" /> : <Zap size={24} />}
                Générer {qty} Coupons
              </button>
            </div>
          </form>
        </div>

        {/* Right Sidebar: Last Batch */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 border-white/5 h-fit">
            <h3 className="text-sm font-heading font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity size={16} className="text-primary" /> Dernière Génération
            </h3>
            
            {lastBatch ? (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-white/30 uppercase">Code Batch</span>
                    <span className="text-primary font-mono">#{lastBatch.code}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-white/30 uppercase">Date</span>
                    <span className="text-white/80">{lastBatch.date}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-white/30 uppercase">Profil</span>
                    <span className="text-white/80">{lastBatch.profileName}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-white/30 uppercase">Quantité</span>
                    <span className="text-white/80">{lastBatch.count} coupons</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold pt-2 border-t border-white/5">
                    <span className="text-white/30 uppercase">Total</span>
                    <span className="text-primary font-mono text-base">{formatCurrency(lastBatch.totalPrice, settings)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => navigate('/tickets?print-last-batch=true')}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <Printer size={20} className="text-white/40 group-hover:text-primary" />
                    <span className="text-[9px] font-bold uppercase text-white/30">Imprimer</span>
                  </button>
                  <button 
                    onClick={() => navigate('/tickets?print-last-batch=true&style=qr')}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <QrCode size={20} className="text-white/40 group-hover:text-secondary" />
                    <span className="text-[9px] font-bold uppercase text-white/30">QR Codes</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (lastBatch && lastBatch.vouchers) {
                        const csvContent = "data:text/csv;charset=utf-8,Username,Password,Profile,Price,TimeLimit\n" 
                          + lastBatch.vouchers.map(v => `${v.username},${v.password},${v.profileName},${v.price},${v.timeLimit}`).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `vouchers_batch_${lastBatch.code}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <FileDown size={20} className="text-white/40 group-hover:text-accent" />
                    <span className="text-[9px] font-bold uppercase text-white/30">Exporter CSV</span>
                  </button>
                  <button 
                    onClick={() => navigate('/tickets')}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <ChevronRight size={20} className="text-white/40 group-hover:text-white" />
                    <span className="text-[9px] font-bold uppercase text-white/30">Voir Liste</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                <Info size={40} />
                <p className="text-xs font-bold uppercase tracking-widest">Aucune donnée récente</p>
                <p className="text-[10px] text-white/50 leading-relaxed px-4">
                  Générez un lot de coupons pour voir le résumé et les options d'impression ici.
                </p>
              </div>
            )}
          </div>

          <div className="glass-card p-6 bg-secondary/5 border-secondary/10">
            <h4 className="text-[10px] font-black uppercase text-secondary tracking-tighter mb-2">💡 Conseil d'expert</h4>
            <p className="text-xs text-white/40 leading-relaxed">
              Le mode <strong className="text-white/60">User = Pass</strong> est idéal pour les tickets à gratter rapides. Pour plus de sécurité, utilisez des noms de 8 caractères minimum.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CouponsPage;
