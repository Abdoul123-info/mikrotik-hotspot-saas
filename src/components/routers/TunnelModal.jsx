import React, { useState, useEffect } from 'react';
import { X, Terminal, Copy, CheckCircle2, Server, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BASE_URL } from '../../config/api';

function TunnelModal({ isOpen, onClose, router }) {
  const { token } = useAuth();
  const [agentKey, setAgentKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && router) {
      fetchAgentKey();
    } else {
      setAgentKey('');
      setCopied(false);
      setError('');
    }
  }, [isOpen, router]);

  const fetchAgentKey = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${BASE_URL}/api/agent/key/${router.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors de la récupération de la clé Agent');
      const data = await res.json();
      setAgentKey(data.agentKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !router) return null;

  // Remplacer BASE_URL par l'URL publique de votre backend (ex: https://mon-serveur.render.com)
  // Si BASE_URL pointe vers localhost, le routeur ne pourra pas s'y connecter.
  const backendHost = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1') 
      ? 'http://VOTRE_IP_PUBLIQUE:3001' 
      : BASE_URL;

  const scriptContent = `:local agentKey "${agentKey}"
:local routerId "${router.id}"
:local backendUrl "${backendHost}/api/agent/push"
:local pendingUrl "${backendHost}/api/agent/pending-script/${router.id}?key=${agentKey}"

:local cpuLoad [/system resource get cpu-load]
:local freeMemory [/system resource get free-memory]
:local totalMemory [/system resource get total-memory]
:local uptime [/system resource get uptime]

:local activeUsersList ""
:foreach i in=[/ip hotspot active find] do={
  :local uName [/ip hotspot active get $i user]
  :local uMac [/ip hotspot active get $i mac-address]
  :local uIp [/ip hotspot active get $i address]
  :local uUptime [/ip hotspot active get $i uptime]
  :local uObj "{\\"user\\":\\"$uName\\", \\"mac-address\\":\\"$uMac\\", \\"address\\":\\"$uIp\\", \\"uptime\\":\\"$uUptime\\"}"
  :if ([:len $activeUsersList] > 0) do={ 
    :set activeUsersList "$activeUsersList, $uObj" 
  } else={ 
    :set activeUsersList $uObj 
  }
}

:local json "{\\"routerId\\":\\"$routerId\\",\\"agentKey\\":\\"$agentKey\\",\\"activeUsers\\": [$activeUsersList], \\"resource\\":{\\"cpuLoad\\":$cpuLoad, \\"freeMemory\\":$freeMemory, \\"totalMemory\\":$totalMemory, \\"uptime\\":\\"$uptime\\"}}"

# 1. Envoyer les statistiques au serveur
:do {
  /tool fetch url=$backendUrl http-method=post http-header-field="Content-Type: application/json" http-data=$json keep-result=no
} on-error={
  :log warning "Agent Push: echec de l envoi des statistiques"
}

# 2. Recuperer et executer les commandes en attente
:do {
  /tool fetch url=$pendingUrl dst-path="pending.rsc"
  :delay 2s
  :if ([:len [/file find name="pending.rsc"]] > 0) do={
    :log info "Agent Push: execution des commandes en attente..."
    :do {
      /import file-name="pending.rsc"
    } on-error={
      /file remove "pending.rsc"
    }
  }
} on-error={
  :log warning "Agent Push: echec de la recuperation des commandes"
}
`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A0C10]/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="glass-card w-full max-w-2xl relative overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        <div className="bg-primary/10 p-6 flex items-center justify-between border-b border-primary/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Terminal size={20} />
            </div>
            <h3 className="text-xl font-heading font-extrabold lg:text-2xl uppercase">
              Script Agent Push
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <Server className="text-primary mt-1 shrink-0" size={24} />
            <div>
              <h4 className="font-bold text-white mb-1">À quoi sert ce script ?</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Si votre routeur MikroTik est derrière un NAT (ex: Starlink, 4G) ou s'il bloque les connexions entrantes, ce script permet au routeur d'envoyer lui-même ses statistiques (utilisateurs actifs, CPU) au serveur toutes les minutes.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold">
              <ShieldAlert size={18} />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-bold text-sm text-white/80 uppercase tracking-widest">
                Script à coller dans le routeur ({router.name})
              </h4>
              <button 
                onClick={handleCopy}
                disabled={loading || !agentKey}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm font-bold disabled:opacity-50"
              >
                {copied ? <CheckCircle2 size={16} className="text-primary" /> : <Copy size={16} />}
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
            
            <div className="relative">
              <pre className="p-4 rounded-xl bg-black/50 border border-white/10 text-white/70 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {loading ? 'Génération de la clé...' : scriptContent}
              </pre>
            </div>
          </div>

          <div className="space-y-2">
             <h4 className="font-heading font-bold text-sm text-white/80 uppercase tracking-widest">
                Instructions
             </h4>
             <ul className="list-decimal list-inside text-sm text-white/60 space-y-2">
               <li>Ouvrez Winbox ou le terminal WebFig de votre MikroTik.</li>
               <li>Allez dans <strong>System &gt; Scripts</strong> et ajoutez un nouveau script nommé <code>agent-push</code>.</li>
               <li>Collez le code ci-dessus dans la zone source et sauvegardez.</li>
               <li>Allez dans <strong>System &gt; Scheduler</strong>.</li>
               <li>Ajoutez une tâche planifiée avec l'intervalle <code>00:01:00</code> (1 minute).</li>
               <li>Dans le champ <strong>On Event</strong>, tapez simplement <code>agent-push</code>.</li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TunnelModal;