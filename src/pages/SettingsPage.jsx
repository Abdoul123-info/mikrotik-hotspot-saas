import React, { useState } from 'react';
import { 
  Settings, 
  Globe, 
  DollarSign, 
  Layout, 
  Image as ImageIcon, 
  MessageSquare, 
  Save, 
  Trash2,
  Check,
  Moon,
  Sun,
  LayoutTemplate
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

function SettingsPage() {
  const { settings, updateSettings, toggleDarkMode } = useSettings();
  const [formData, setFormData] = useState(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logoBase64: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-right duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white">Réglages Système</h1>
          <p className="text-white/40 font-body">Personnalisez votre application et configurez vos préférences de facturation.</p>
        </div>
        {saveSuccess && (
          <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/10 px-4 py-2 rounded-xl animate-bounce">
            <Check size={18} /> Modifications enregistrées !
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* General App Settings */}
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-heading font-bold flex items-center gap-2 border-b border-white/5 pb-4">
              <Layout size={18} className="text-primary" /> Application
            </h3>
            
            <div className="space-y-3">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest">Nom de l'App</label>
              <input 
                type="text" 
                className="input-glass w-full"
                value={formData.appName}
                onChange={(e) => setFormData({...formData, appName: e.target.value})}
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest">Langue par défaut</label>
              <select 
                className="input-glass w-full bg-[#151921]"
                value={formData.language}
                onChange={(e) => setFormData({...formData, language: e.target.value})}
              >
                <option value="FR">Français (FR)</option>
                <option value="EN">English (EN)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <p className="font-bold text-sm">Mode Sombre</p>
                <p className="text-[10px] text-white/40 uppercase">Activé par défaut</p>
              </div>
              <button 
                type="button"
                onClick={toggleDarkMode}
                className={`w-12 h-6 rounded-full transition-all relative ${settings.darkMode ? 'bg-primary' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.darkMode ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* Currency Settings */}
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-heading font-bold flex items-center gap-2 border-b border-white/5 pb-4">
              <DollarSign size={18} className="text-secondary" /> Devise & Prix
            </h3>
            
            <div className="space-y-3">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest">Symbole (Manuel)</label>
              <input 
                type="text" 
                className="input-glass w-full font-mono text-xl"
                placeholder="ex: FCFA, GNF, $, €"
                value={formData.currencySymbol}
                onChange={(e) => setFormData({...formData, currencySymbol: e.target.value})}
              />
              <p className="text-[10px] text-white/20 italic">Entrez n'importe quel symbole ou code pays.</p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest">Position du Symbole</label>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, currencyPosition: 'before'})}
                  className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${formData.currencyPosition === 'before' ? 'bg-secondary text-white' : 'text-white/40 hover:text-white'}`}
                >
                  Avant [ $10 ]
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, currencyPosition: 'after'})}
                  className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${formData.currencyPosition === 'after' ? 'bg-secondary text-white' : 'text-white/40 hover:text-white'}`}
                >
                  Après [ 10 € ]
                </button>
              </div>
            </div>
          </div>

          {/* Business Info */}
          <div className="glass-card p-6 space-y-6 md:col-span-2">
            <h3 className="text-lg font-heading font-bold flex items-center gap-2 border-b border-white/5 pb-4">
              <Globe size={18} className="text-accent" /> Informations Entreprise
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest">Nom Commercial</label>
                  <input 
                    type="text" 
                    className="input-glass w-full"
                    value={formData.businessName}
                    onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest">Adresse Physique</label>
                  <textarea 
                    className="input-glass w-full h-24 resize-none"
                    value={formData.businessAddress}
                    onChange={(e) => setFormData({...formData, businessAddress: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest">Logo (Tickets)</label>
                <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:border-primary/40 transition-all group overflow-hidden h-[180px]">
                  {formData.logoBase64 ? (
                    <div className="relative w-full h-full group">
                      <img src={formData.logoBase64} alt="Preview" className="w-full h-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, logoBase64: null})}
                        className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={24} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:text-primary transition-all">
                        <ImageIcon size={24} />
                      </div>
                      <label className="text-xs font-bold text-white/40 hover:text-white cursor-pointer uppercase tracking-widest">
                        Choisir une image
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Settings */}
          <div className="glass-card p-6 space-y-6 md:col-span-2">
            <h3 className="text-lg font-heading font-bold flex items-center gap-2 border-b border-white/5 pb-4">
              <MessageSquare size={18} className="text-primary" /> Pied de page des Tickets
            </h3>
            
            <div className="space-y-3">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest">Message Personnalisé</label>
              <input 
                type="text" 
                className="input-glass w-full"
                placeholder="ex: Bonne navigation ! Contact: 99xxxxxx"
                value={formData.ticketFooter}
                onChange={(e) => setFormData({...formData, ticketFooter: e.target.value})}
              />
              <p className="text-[10px] text-white/20 italic">Ce texte sera imprimé en bas de chaque ticket voucher.</p>
            </div>
          </div>
        </div>

        <button type="submit" className="w-full btn-primary h-16 flex items-center justify-center gap-3 text-lg font-black uppercase tracking-[0.2em] shadow-primary/20">
          <Save size={24} />
          Sauvegarder la Configuration
        </button>
      </form>
    </div>
  );
}

export default SettingsPage;
