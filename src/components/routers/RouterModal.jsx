import React, { useState } from 'react';
import { X, Wifi, Shield, Globe, Terminal, Save } from 'lucide-react';

function RouterModal({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    port: '8728',
    login: 'admin',
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, port: formData.port.toString() });
    setFormData({ name: '', ip: '', port: '80', login: 'admin', password: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A0C10]/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="glass-card w-full max-w-xl relative overflow-hidden animate-in zoom-in duration-300">
        <div className="bg-primary/10 p-6 flex items-center justify-between border-b border-primary/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Wifi size={20} />
            </div>
            <h3 className="text-xl font-heading font-extrabold lg:text-2xl uppercase">Ajouter un Routeur</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Globe size={14} className="text-primary" /> Nom du Routeur
              </label>
              <input 
                type="text" 
                required
                className="input-glass w-full"
                placeholder="ex: Niamey-Secteur-3"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Wifi size={14} className="text-secondary" /> Adresse IP / Host
              </label>
              <input 
                type="text" 
                required
                className="input-glass w-full"
                placeholder="192.168.88.1"
                value={formData.ip}
                onChange={(e) => setFormData({...formData, ip: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Terminal size={14} className="text-accent" /> Port API
              </label>
              <input 
                type="text" 
                required
                className="input-glass w-full"
                placeholder="8728"
                value={formData.port}
                onChange={(e) => setFormData({...formData, port: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Shield size={14} className="text-blue-400" /> Identifiant API
              </label>
              <input 
                type="text" 
                required
                className="input-glass w-full"
                placeholder="admin"
                value={formData.login}
                onChange={(e) => setFormData({...formData, login: e.target.value})}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-heading font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Shield size={14} className="text-red-400" /> Mot de passe API
              </label>
              <input 
                type="password" 
                className="input-glass w-full"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-bold uppercase">
              Annuler
            </button>
            <button type="submit" className="flex-1 btn-primary flex items-center justify-center gap-2 uppercase">
              <Save size={18} />
              <span>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RouterModal;
