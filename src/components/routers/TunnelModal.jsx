import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Info, ShieldCheck } from 'lucide-react';

export default function TunnelModal({ isOpen, onClose, router }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !router) return null;

  // Configuration du tunnel (Sera dynamique plus tard avec l'URL du VPS)
  const serverUrl = "vpn.ton-domaine-saas.com";
  const tunnelUser = `user_${router.id.substring(0, 8)}`;
  const tunnelPass = `pass_${Math.random().toString(36).substring(2, 10)}`;
  
  // Le Script MikroTik Pro
  const script = `# Configuration du Tunnel SaaS pour ${router.name}
/interface sstp-client
add connect-to=${serverUrl} disabled=no name=SaaS-Tunnel \\
    password=${tunnelPass} profile=default-encryption user=${tunnelUser} \\
    verify-server-certificate=no
    
# Optimisation de la connexion API via le tunnel
/ip service
set api disabled=no port=8728
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-dark/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#0F1219] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div className="scanner-line"></div>
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Terminal size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-extrabold text-white">Générateur de Tunnel</h2>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Accès distant sécurisé</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-white/40 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex gap-3 items-start">
            <Info size={18} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-white/70 leading-relaxed">
              Ce script permet à votre MikroTik de se connecter à notre serveur sécurisé. Copiez et collez-le dans le <span className="text-primary font-bold">Terminal</span> de votre Winbox pour activer l'accès à distance.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Script MikroTik (Terminal)</label>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 text-[10px] font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
              >
                {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier le script</>}
              </button>
            </div>
            
            <div className="relative group">
              <pre className="bg-bg-dark border border-white/5 p-5 rounded-2xl text-xs font-mono text-primary/80 overflow-x-auto max-h-[250px] leading-relaxed">
                {script}
              </pre>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/30 justify-center">
            <ShieldCheck size={14} className="text-primary/40" />
            Connexion chiffrée en AES-256 via tunnel SSTP (Port 443)
          </div>
        </div>

        <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            J'ai terminé
          </button>
        </div>
      </div>
    </div>
  );
}
