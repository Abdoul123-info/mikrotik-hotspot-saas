import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Settings2, 
  Clock, 
  Database, 
  Zap, 
  CircleDollarSign,
  Plus,
  RefreshCw,
  Hash,
  Activity,
  History,
  TrendingUp
} from 'lucide-react';
import { getVoucherProfiles, generateVouchers } from '../api/mikrotik.real';
import { useSettings } from '../contexts/SettingsContext';
import { useRouter } from '../contexts/RouterContext';
import { formatCurrency } from '../utils/currency';
import { useNavigate } from 'react-router-dom';

function CouponsPage() {
  const { settings } = useSettings();
  const { activeRouter } = useRouter();
  const navigate = useNavigate();
  
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeRouter) {
      setIsLoading(true);
      getVoucherProfiles(activeRouter).then(data => {
        setProfiles(data);
        if (data.length > 0) setSelectedProfileId(data[0].id);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    }
  }, [activeRouter]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!activeRouter) return alert('Sélectionnez un routeur d\'abord');
    
    setIsGenerating(true);
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return;

    try {
      await generateVouchers(activeRouter, profile, quantity);
      setIsGenerating(false);
      navigate('/tickets');
    } catch (err) {
      alert('Erreur: ' + err.message);
      setIsGenerating(false);
    }
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-right duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white">Générateur de Coupons</h1>
          <p className="text-white/40 font-body">Connecté à : <span className="text-primary font-bold">{activeRouter?.name || '---'}</span></p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <RefreshCw className="animate-spin text-primary" size={32} />
              <p className="text-white/40 uppercase text-xs font-bold tracking-widest">Chargement des profils...</p>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <Settings2 size={14} className="text-primary" /> Profils de votre Router
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {Array.isArray(profiles) && profiles.length > 0 ? (
                      profiles.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedProfileId(p.id)}
                          className={`p-4 rounded-xl border flex items-center justify-between transition-all group ${
                            selectedProfileId === p.id 
                            ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10' 
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Tag size={16} className={selectedProfileId === p.id ? 'text-primary' : 'text-white/20'} />
                            <span className="font-bold text-sm">{p.name}</span>
                          </div>
                          <span className="text-[10px] text-white/40 font-mono italic">
                            {p.price > 0 ? formatCurrency(p.price, settings) : 'Gratuit'}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="p-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                        <p className="text-xs text-white/40 italic">Aucun profil disponible pour le moment.</p>
                      </div>
                    )}
                    {Array.isArray(profiles) && profiles.length === 0 && !isLoading && (
                      <p className="text-xs text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20">
                        Aucun profil trouvé. Créez des profils dans Winbox sous `/ip hotspot user profile`.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                      <Hash size={14} className="text-secondary" /> Quantité
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100" 
                      required
                      className="input-glass w-full text-xl font-extrabold tracking-tight"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <p className="text-[10px] uppercase font-bold text-white/20">Instructions</p>
                    <p className="text-xs text-white/60 leading-relaxed italic">
                      Les coupons seront créés instantanément sur votre MikroTik via le Proxy REST API.
                    </p>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isGenerating || profiles.length === 0}
                className={`w-full btn-primary h-16 flex items-center justify-center gap-3 text-lg lg:text-xl uppercase tracking-widest ${isGenerating ? 'opacity-70 animate-pulse' : ''}`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="animate-spin" size={24} />
                    <span>Création en cours...</span>
                  </>
                ) : (
                  <>
                    <Plus size={24} />
                    <span>Générer sur MikroTik</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 bg-primary/5 border-primary/10">
            <h3 className="text-lg font-heading font-bold mb-6 flex items-center gap-2">
              <Activity size={18} className="text-primary" /> Infos Profil Distant
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-[10px] uppercase font-bold text-white/40">Timeout</span>
                <span className="font-mono font-bold">{selectedProfile?.timeLimit || '---'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-[10px] uppercase font-bold text-white/40">Quota</span>
                <span className="font-mono font-bold">{selectedProfile?.dataLimit || '---'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[10px] uppercase font-bold text-white/40">ID Profil</span>
                <span className="text-[10px] font-mono text-white/20">{selectedProfile?.id || '---'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CouponsPage;
