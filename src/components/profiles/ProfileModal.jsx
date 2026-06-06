import React, { useState, useEffect } from 'react';
import { X, Zap, Clock, Download, Upload, Users, Shield, Timer, CircleDollarSign, Save, Loader2 } from 'lucide-react';

const SESSION_PRESETS = [
  { label: '30 min', value: '00:30:00' },
  { label: '1 heure', value: '01:00:00' },
  { label: '2 heures', value: '02:00:00' },
  { label: '3 heures', value: '03:00:00' },
  { label: '6 heures', value: '06:00:00' },
  { label: '12 heures', value: '12:00:00' },
  { label: '24 heures', value: '1d 00:00:00' },
  { label: '3 jours', value: '3d 00:00:00' },
  { label: '7 jours', value: '7d 00:00:00' },
  { label: '14 jours', value: '14d 00:00:00' },
  { label: '30 jours', value: '30d 00:00:00' },
  { label: 'Illimité', value: '' },
];

const SPEED_PRESETS = [
  { label: '256k', value: '256k' },
  { label: '512k', value: '512k' },
  { label: '1M', value: '1M' },
  { label: '2M', value: '2M' },
  { label: '3M', value: '3M' },
  { label: '5M', value: '5M' },
  { label: '10M', value: '10M' },
  { label: '20M', value: '20M' },
  { label: '50M', value: '50M' },
  { label: 'Illimité', value: '' },
];

const IDLE_PRESETS = [
  { label: 'Aucun', value: '' },
  { label: '5 min', value: '00:05:00' },
  { label: '10 min', value: '00:10:00' },
  { label: '15 min', value: '00:15:00' },
  { label: '30 min', value: '00:30:00' },
];

export default function ProfileModal({ isOpen, onClose, onSave, initialData }) {
  const isEditing = !!initialData;

  const [form, setForm] = useState({
    name: '',
    price: '',
    sessionTimeout: '01:00:00',
    uploadSpeed: '2M',
    downloadSpeed: '5M',
    sharedUsers: 1,
    expiryMode: 'remove',
    idleTimeout: '00:05:00',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        price: initialData.price || '',
        sessionTimeout: initialData.timeLimit === 'Illimité' ? '' : initialData.timeLimit || '01:00:00',
        uploadSpeed: initialData.uploadLimit || '2M',
        downloadSpeed: initialData.downloadLimit || '5M',
        sharedUsers: initialData.sharedUsers || 1,
        expiryMode: initialData.expiryMode || 'remove',
        idleTimeout: initialData.idleTimeout || '',
      });
    } else {
      setForm({
        name: '', price: '', sessionTimeout: '01:00:00',
        uploadSpeed: '2M', downloadSpeed: '5M', sharedUsers: 1,
        expiryMode: 'remove', idleTimeout: '00:05:00',
      });
    }
    setError('');
  }, [initialData, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Le nom du profil est obligatoire'); return; }
    if (form.price === '' || isNaN(form.price)) { setError('Le prix est obligatoire'); return; }

    setSaving(true);
    setError('');

    const rateLimit = (form.uploadSpeed && form.downloadSpeed)
      ? `${form.uploadSpeed}/${form.downloadSpeed}`
      : (form.uploadSpeed || form.downloadSpeed || '');

    try {
      await onSave({
        name: form.name.trim(),
        price: parseInt(form.price) || 0,
        sessionTimeout: form.sessionTimeout || '',
        rateLimit,
        sharedUsers: parseInt(form.sharedUsers) || 1,
        expiryMode: form.expiryMode,
        idleTimeout: form.idleTimeout || '',
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto neon-card p-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 border-b border-white/10 bg-[#07090D]/95 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <Zap className="text-primary" size={20} />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-lg uppercase tracking-wider">
                {isEditing ? 'Modifier le Profil' : 'Nouveau Profil'}
              </h2>
              <p className="text-[10px] text-white/30 uppercase tracking-widest">
                Hotspot User Profile
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-all text-white/40 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold animate-pulse">
              ⚠️ {error}
            </div>
          )}

          {/* Row 1: Name + Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-white/40 tracking-widest flex items-center gap-1.5">
                <Zap size={10} className="text-primary" /> Nom du profil
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                disabled={isEditing}
                placeholder="ex: 1Heure-500F"
                className="w-full bg-white/5 border border-white/10 focus:border-primary outline-none text-white p-3.5 rounded-xl transition-all focus:ring-2 focus:ring-primary/10 text-sm font-bold disabled:opacity-40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-white/40 tracking-widest flex items-center gap-1.5">
                <CircleDollarSign size={10} className="text-accent" /> Prix (FCFA)
              </label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="500"
                className="w-full bg-white/5 border border-white/10 focus:border-primary outline-none text-white p-3.5 rounded-xl transition-all focus:ring-2 focus:ring-primary/10 text-sm font-bold"
              />
            </div>
          </div>

          {/* Row 2: Session Timeout */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-white/40 tracking-widest flex items-center gap-1.5">
              <Clock size={10} className="text-secondary" /> Durée de session
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {SESSION_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, sessionTimeout: p.value }))}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    form.sessionTimeout === p.value
                      ? 'bg-secondary/20 border-secondary text-secondary shadow-lg shadow-secondary/10'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Speed Limits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-white/40 tracking-widest flex items-center gap-1.5">
                <Upload size={10} className="text-primary" /> Upload
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {SPEED_PRESETS.slice(0, 5).map(s => (
                  <button key={s.value} type="button"
                    onClick={() => setForm(f => ({ ...f, uploadSpeed: s.value }))}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                      form.uploadSpeed === s.value
                        ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >{s.label}</button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {SPEED_PRESETS.slice(5).map(s => (
                  <button key={s.value} type="button"
                    onClick={() => setForm(f => ({ ...f, uploadSpeed: s.value }))}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                      form.uploadSpeed === s.value
                        ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >{s.label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-white/40 tracking-widest flex items-center gap-1.5">
                <Download size={10} className="text-secondary" /> Download
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {SPEED_PRESETS.slice(0, 5).map(s => (
                  <button key={s.value} type="button"
                    onClick={() => setForm(f => ({ ...f, downloadSpeed: s.value }))}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                      form.downloadSpeed === s.value
                        ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >{s.label}</button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {SPEED_PRESETS.slice(5).map(s => (
                  <button key={s.value} type="button"
                    onClick={() => setForm(f => ({ ...f, downloadSpeed: s.value }))}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                      form.downloadSpeed === s.value
                        ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >{s.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 4: Shared Users + Idle + Expiry */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-white/40 tracking-widest flex items-center gap-1.5">
                <Users size={10} className="text-primary" /> Appareils simultanés
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 5].map(n => (
                  <button key={n} type="button"
                    onClick={() => setForm(f => ({ ...f, sharedUsers: n }))}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                      form.sharedUsers === n
                        ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >{n}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-white/40 tracking-widest flex items-center gap-1.5">
                <Timer size={10} className="text-accent" /> Timeout Inactivité
              </label>
              <select
                value={form.idleTimeout}
                onChange={e => setForm(f => ({ ...f, idleTimeout: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 text-white p-3 rounded-xl text-sm font-bold focus:border-primary outline-none appearance-none cursor-pointer"
              >
                {IDLE_PRESETS.map(p => (
                  <option key={p.value} value={p.value} className="bg-[#07090D]">{p.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-white/40 tracking-widest flex items-center gap-1.5">
                <Shield size={10} className="text-red-400" /> Mode d'expiration
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'remove', label: 'Supprimer' },
                  { id: 'disable', label: 'Désactiver' },
                ].map(m => (
                  <button key={m.id} type="button"
                    onClick={() => setForm(f => ({ ...f, expiryMode: m.id }))}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${
                      form.expiryMode === m.id
                        ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >{m.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-2">
            <p className="text-[9px] text-white/20 uppercase font-black tracking-widest">Aperçu on-login (Mikhmon)</p>
            <code className="text-[10px] text-primary/80 font-mono block break-all">
              {`:put (",remc,${form.price || 0},${form.sessionTimeout || '0s'},${form.sharedUsers},,${form.expiryMode === 'disable' ? 'Enable' : 'Remove'},")`}
            </code>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full btn-primary h-14 flex items-center justify-center gap-3 text-sm"
          >
            {saving ? (
              <><Loader2 className="animate-spin" size={20} /> Sauvegarde...</>
            ) : (
              <><Save size={20} /> {isEditing ? 'Mettre à jour le profil' : 'Créer le profil sur MikroTik'}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
