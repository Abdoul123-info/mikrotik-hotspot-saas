import React from 'react';
import { Pencil, Trash2, Clock, Download, Upload, Users, Shield, CircleDollarSign, Zap, Lock } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { formatCurrency } from '../../utils/currency';

export default function ProfileCard({ profile, onEdit, onDelete, isDeleting }) {
  const { settings } = useSettings();
  const isProtected = profile.isDefault;

  return (
    <div className={`neon-card p-5 group transition-all duration-500 hover:scale-[1.02] ${isProtected ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/40 transition-all">
            <Zap size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider text-white group-hover:text-primary transition-colors">
              {profile.name}
            </h3>
            {isProtected && (
              <span className="text-[8px] text-white/30 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                <Lock size={8} /> Profil système
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-extrabold text-primary font-mono">
            {profile.price > 0 ? formatCurrency(profile.price, settings) : 'Gratuit'}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={10} className="text-secondary" />
            <span className="text-[8px] uppercase font-black text-white/30 tracking-wider">Durée</span>
          </div>
          <p className="text-xs font-bold font-mono text-white/80">{profile.timeLimit}</p>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={10} className="text-primary" />
            <span className="text-[8px] uppercase font-black text-white/30 tracking-wider">Appareils</span>
          </div>
          <p className="text-xs font-bold font-mono text-white/80">{profile.sharedUsers || 1}</p>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Upload size={10} className="text-primary" />
            <span className="text-[8px] uppercase font-black text-white/30 tracking-wider">Upload</span>
          </div>
          <p className="text-xs font-bold font-mono text-white/80">{profile.uploadLimit || '∞'}</p>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Download size={10} className="text-secondary" />
            <span className="text-[8px] uppercase font-black text-white/30 tracking-wider">Download</span>
          </div>
          <p className="text-xs font-bold font-mono text-white/80">{profile.downloadLimit || '∞'}</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-[8px] uppercase font-black tracking-widest text-white/20 flex items-center gap-1">
          <Shield size={8} />
          {profile.expiryMode === 'disable' ? 'Désactiver' : 'Supprimer'} à l'expiration
        </span>
        {profile.dataLimit !== 'Illimité' && (
          <span className="text-[8px] font-mono text-white/30">{profile.dataLimit}</span>
        )}
      </div>

      {/* Actions */}
      {!isProtected && (
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(profile)}
            className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all text-primary text-xs font-bold uppercase tracking-wider"
          >
            <Pencil size={14} /> Modifier
          </button>
          <button
            onClick={() => onDelete(profile)}
            disabled={isDeleting}
            className="h-10 px-4 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-red-400 disabled:opacity-40"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
