import React from 'react';
import { Share2, Printer, Copy, Check, QrCode, ShieldOff, ShieldCheck } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { formatCurrency } from '../../utils/currency';

function VoucherCard({ voucher, onPrint, onShare, onUnblock }) {
  const { settings } = useSettings();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${voucher.username} / ${voucher.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`glass-card p-5 relative group overflow-hidden transition-all 
      ${voucher.status === 'used' ? 'opacity-50 grayscale' : ''} 
      ${voucher.disabled ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-primary/10 hover:border-primary/30'}
    `}>
      {/* Online Badge */}
      {voucher.status === 'online' && (
        <div className="absolute top-3 right-3 px-2 py-0.5 bg-primary/20 border border-primary/30 rounded-full flex items-center gap-1 text-[8px] font-black uppercase text-primary animate-pulse z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          En Ligne
        </div>
      )}

      {/* Blocked Badge */}
      {voucher.disabled && (
        <div className="absolute top-3 right-3 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full flex items-center gap-1 text-[8px] font-black uppercase text-red-500 z-10">
          <ShieldOff size={8} />
          Bloqué
        </div>
      )}

      {/* Decorative background elements */}
      <div className="absolute -right-6 -top-6 w-20 h-20 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all" />
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-lg font-heading font-extrabold text-primary">{voucher.profileName}</h4>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">{voucher.timeLimit} • {voucher.dataLimit}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-extrabold">{formatCurrency(voucher.price, settings)}</p>
          <p className="text-[10px] text-white/30">
            {voucher.createdAt ? (
              voucher.createdAt.includes('/') ? voucher.createdAt : new Date(voucher.createdAt).toLocaleDateString()
            ) : 'Date inconnue'}
          </p>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3 mb-4">
        <div className="flex justify-between items-center group/field">
          <span className="text-[10px] uppercase font-heading font-bold text-white/30">Utilisateur</span>
          <span className="font-mono font-bold text-primary group-hover/field:scale-110 transition-all">{voucher.username}</span>
        </div>
        <div className="flex justify-between items-center group/field">
          <span className="text-[10px] uppercase font-heading font-bold text-white/30">Mot de passe</span>
          {voucher.password === '(caché)' ? (
            <span className="font-mono text-xs italic text-white/30">(caché par le routeur)</span>
          ) : (
            <span className="font-mono font-bold text-white group-hover/field:scale-110 transition-all">{voucher.password}</span>
          )}
        </div>
        
        {/* Real Stats Section */}
        {voucher.stats && (voucher.status === 'online' || voucher.stats.uptime !== '0s' || voucher.stats.bytesOut > 0) && (
          <div className="pt-2 border-t border-white/5 space-y-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col">
                <span className="text-[8px] uppercase text-white/20 font-bold">Uptime</span>
                <span className="text-[10px] font-mono text-white/60">{voucher.stats.uptime || '0s'}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[8px] uppercase text-white/20 font-bold">Conso</span>
                <span className="text-[10px] font-mono text-white/60">
                  {Math.round((voucher.stats.bytesOut + voucher.stats.bytesIn) / 1024 / 1024)} MB
                </span>
              </div>
            </div>
            {voucher.stats.ip && (
              <div className="flex justify-between items-center pt-1 border-t border-white/5">
                <span className="text-[8px] uppercase text-white/20 font-bold">IP</span>
                <span className="text-[9px] font-mono text-primary/60">{voucher.stats.ip}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button 
          onClick={handleCopy}
          className="flex-1 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/60 hover:text-white"
          title="Copier ID/Pass"
        >
          {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
        </button>
        <button 
          onClick={() => onPrint(voucher)}
          className="flex-1 h-10 flex items-center justify-center rounded-lg bg-primary/20 border border-primary/20 hover:bg-primary/30 transition-all text-primary"
          title="Imprimer"
        >
          <Printer size={16} />
        </button>
        <button 
          onClick={() => onShare(voucher)}
          className="flex-1 h-10 flex items-center justify-center rounded-lg bg-secondary/20 border border-secondary/20 hover:bg-secondary/30 transition-all text-secondary"
          title="Partager WhatsApp"
        >
          <Share2 size={16} />
        </button>
        {voucher.disabled && (
          <button 
            onClick={() => onUnblock(voucher)}
            className="flex-1 h-10 flex items-center justify-center rounded-lg bg-green-500/20 border border-green-500/20 hover:bg-green-500/40 transition-all text-green-400"
            title="Débloquer le ticket"
          >
            <ShieldCheck size={18} />
          </button>
        )}
      </div>

      {voucher.status === 'used' && (
        <div className="absolute inset-0 bg-[#0A0C10]/40 flex items-center justify-center pointer-events-none">
          <div className="rotate-[-15deg] border-4 border-red-500/40 text-red-500/40 px-4 py-1 font-heading font-black text-2xl uppercase tracking-tighter">UTILISÉ</div>
        </div>
      )}
    </div>
  );
}

export default VoucherCard;
