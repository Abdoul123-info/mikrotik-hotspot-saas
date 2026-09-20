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

  // Si BASE_URL pointe vers localhost, utiliser l'URL publique de Render pour le script MikroTik
  const backendHost = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1') 
      ? 'https://mikrotik-hotspot-saas-1.onrender.com' 
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
  :local uMac ""
  :do { :set uMac [/ip hotspot active get $i mac-address] } on-error={}
  :local uIp ""
  :do { :set uIp [/ip hotspot active get $i address] } on-error={}
  :local uUptime ""
  :do { :set uUptime [/ip hotspot active get $i uptime] } on-error={}
  :local uBytesIn "0"
  :do { :set uBytesIn [/ip hotspot active get $i bytes-in] } on-error={}
  :local uBytesOut "0"
  :do { :set uBytesOut [/ip hotspot active get $i bytes-out] } on-error={}
  :local uTimeLeft ""
  :do { :set uTimeLeft [/ip hotspot active get $i session-time-left] } on-error={}
  :local uIdleTime ""
  :do { :set uIdleTime [/ip hotspot active get $i idle-time] } on-error={}
  :local uServer ""
  :do { :set uServer [/ip hotspot active get $i server] } on-error={}
  :local uProf ""
  :do { :set uProf [/ip hotspot user get [find name=$uName] profile] } on-error={}
  
  :local uObj "{\\"user\\":\\"$uName\\",\\"mac-address\\":\\"$uMac\\",\\"address\\":\\"$uIp\\",\\"uptime\\":\\"$uUptime\\",\\"bytes-in\\":\\"$uBytesIn\\",\\"bytes-out\\":\\"$uBytesOut\\",\\"session-time-left\\":\\"$uTimeLeft\\",\\"idle-time\\":\\"$uIdleTime\\",\\"server\\":\\"$uServer\\",\\"profile\\":\\"$uProf\\"}"
  :if ([:len $activeUsersList] > 0) do={ 
    :set activeUsersList "$activeUsersList,$uObj" 
  } else={ 
    :set activeUsersList $uObj 
  }
}

:local profilesList ""
:foreach i in=[/ip hotspot user profile find] do={
  :local pName [/ip hotspot user profile get $i name]
  :local pComment ""
  :do { :set pComment [/ip hotspot user profile get $i comment] } on-error={}
  :local pRate ""
  :do { :set pRate [/ip hotspot user profile get $i rate-limit] } on-error={}
  :local pShared "1"
  :do { :set pShared [/ip hotspot user profile get $i shared-users] } on-error={}
  
  :local pObj "{\\"name\\":\\"$pName\\",\\"comment\\":\\"$pComment\\",\\"rate-limit\\":\\"$pRate\\",\\"shared-users\\":\\"$pShared\\"}"
  :if ([:len $profilesList] > 0) do={
    :set profilesList "$profilesList,$pObj"
  } else={
    :set profilesList $pObj
  }
}

:local usersList ""
:foreach p in=[/ip hotspot user profile find] do={
  :local pName [/ip hotspot user profile get $p name]
  :local pUsers [/ip hotspot user find profile=$pName]
  :local pLen [:len $pUsers]
  :if ($pLen > 0) do={
    :local startIdx ($pLen - 1)
    :local endIdx ($pLen - 30)
    :if ($endIdx < 0) do={ :set endIdx 0 }
    :for idx from=$startIdx to=$endIdx step=-1 do={
      :local i [:pick $pUsers $idx]
      :local uName [/ip hotspot user get $i name]
      :local uPassword ""
      :do { :set uPassword [/ip hotspot user get $i password] } on-error={}
      :local uProfile ""
      :do { :set uProfile [/ip hotspot user get $i profile] } on-error={}
      :local uComment ""
      :do { :set uComment [/ip hotspot user get $i comment] } on-error={}
      :local uUptime "0s"
      :do { :set uUptime [/ip hotspot user get $i uptime] } on-error={}
      :local uBytesIn "0"
      :do { :set uBytesIn [/ip hotspot user get $i bytes-in] } on-error={}
      :local uBytesOut "0"
      :do { :set uBytesOut [/ip hotspot user get $i bytes-out] } on-error={}
      :local uLimitUptime ""
      :do { :set uLimitUptime [/ip hotspot user get $i limit-uptime] } on-error={}
      :local uLimitBytes ""
      :do { :set uLimitBytes [/ip hotspot user get $i limit-bytes-total] } on-error={}
      :local uDisabled false
      :do { :set uDisabled [/ip hotspot user get $i disabled] } on-error={}

      :local uDisStr "false"
      :if ($uDisabled = true) do={ :set uDisStr "true" }

      :local uObj "{\\"name\\":\\"$uName\\",\\"password\\":\\"$uPassword\\",\\"profile\\":\\"$uProfile\\",\\"comment\\":\\"$uComment\\",\\"uptime\\":\\"$uUptime\\",\\"bytes-in\\":\\"$uBytesIn\\",\\"bytes-out\\":\\"$uBytesOut\\",\\"limit-uptime\\":\\"$uLimitUptime\\",\\"limit-bytes-total\\":\\"$uLimitBytes\\",\\"disabled\\":$uDisStr}"
      :if ([:len $usersList] > 0) do={
        :set usersList "$usersList,$uObj"
      } else={
        :set usersList $uObj
      }
    }
  }
}

:local salesList ""
:local sales [/system script find comment="mikhmon"]
:local salesLen [:len $sales]
:if ($salesLen > 0) do={
  :local startIdx ($salesLen - 1)
  :local endIdx ($salesLen - 100)
  :if ($endIdx < 0) do={ :set endIdx 0 }
  :for idx from=$startIdx to=$endIdx step=-1 do={
    :local i [:pick $sales $idx]
    :local sName [/system script get $i name]
    :local sComment ""
    :do { :set sComment [/system script get $i comment] } on-error={}
    
    :local sObj "{\\"name\\":\\"$sName\\",\\"comment\\":\\"$sComment\\"}"
    :if ([:len $salesList] > 0) do={
      :set salesList "$salesList,$sObj"
    } else={
      :set salesList $sObj
    }
  }
}

:local serversList ""
:foreach i in=[/ip hotspot find] do={
  :local sName [/ip hotspot get $i name]
  :local sProfile [/ip hotspot get $i profile]
  
  :local sObj "{\\"name\\":\\"$sName\\",\\"profile\\":\\"$sProfile\\"}"
  :if ([:len $serversList] > 0) do={
    :set serversList "$serversList,$sObj"
  } else={
    :set serversList $sObj
  }
}

:local leasesList ""
:local leases [/ip dhcp-server lease find]
:local leasesLen [:len $leases]
:if ($leasesLen > 0) do={
  :local startIdx ($leasesLen - 1)
  :local endIdx ($leasesLen - 30)
  :if ($endIdx < 0) do={ :set endIdx 0 }
  :for idx from=$startIdx to=$endIdx step=-1 do={
    :local i [:pick $leases $idx]
    :local lAddress ""
    :do { :set lAddress [/ip dhcp-server lease get $i address] } on-error={}
    :local lMac ""
    :do { :set lMac [/ip dhcp-server lease get $i mac-address] } on-error={}
    :local lHost ""
    :do { :set lHost [/ip dhcp-server lease get $i host-name] } on-error={}
    :local lStatus ""
    :do { :set lStatus [/ip dhcp-server lease get $i status] } on-error={}
    :local lComment ""
    :do { :set lComment [/ip dhcp-server lease get $i comment] } on-error={}
    :local lLastSeen ""
    :do { :set lLastSeen [/ip dhcp-server lease get $i last-seen] } on-error={}
    
    :local lObj "{\\"address\\":\\"$lAddress\\",\\"mac-address\\":\\"$lMac\\",\\"host-name\\":\\"$lHost\\",\\"status\\":\\"$lStatus\\",\\"comment\\":\\"$lComment\\",\\"last-seen\\":\\"$lLastSeen\\"}"
    :if ([:len $leasesList] > 0) do={
      :set leasesList "$leasesList,$lObj"
    } else={
      :set leasesList $lObj
    }
  }
}

:local json "{\\"routerId\\":\\"$routerId\\",\\"agentKey\\":\\"$agentKey\\",\\"activeUsers\\":[$activeUsersList],\\"userProfiles\\":[$profilesList],\\"hotspotUsers\\":[$usersList],\\"mikhmonSales\\":[$salesList],\\"hotspotServers\\":[$serversList],\\"dhcpLeases\\":[$leasesList],\\"resource\\":{\\"cpuLoad\\":$cpuLoad,\\"freeMemory\\":$freeMemory,\\"totalMemory\\":$totalMemory,\\"uptime\\":\\"$uptime\\"}}"

# 1. Envoyer les statistiques au serveur
:do {
  /tool fetch url=$backendUrl http-method=post http-header-field="Content-Type: application/json" http-data=$json keep-result=no
  :log info "Agent Push: sync complete"
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