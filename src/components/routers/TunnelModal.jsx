import React, { useState, useEffect } from 'react';
import { 
  X, Terminal, Copy, CheckCircle2, Server, ShieldAlert, 
  Zap, Loader2, Sparkles, AlertCircle, ChevronDown, ChevronUp,
  Globe, Wifi
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BASE_URL } from '../../config/api';

function TunnelModal({ isOpen, onClose, router }) {
  const { token } = useAuth();
  const [agentKey, setAgentKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedOneLiner, setCopiedOneLiner] = useState(false);
  const [error, setError] = useState('');
  
  // Modes de connexion : 'auto' (IF test les deux), 'remote' (ZeroTier/VPN), 'local' (à côté)
  const [connectionMode, setConnectionMode] = useState('auto');
  const [remoteIp, setRemoteIp] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [password, setPassword] = useState('');

  // États d'injection automatique
  const [injecting, setInjecting] = useState(false);
  const [injectSuccess, setInjectSuccess] = useState(null);
  const [injectError, setInjectError] = useState(null);
  const [injectTip, setInjectTip] = useState(null);
  const [deviceNotice, setDeviceNotice] = useState(null);
  const [showFullScript, setShowFullScript] = useState(false);

  useEffect(() => {
    if (isOpen && router) {
      fetchAgentKey();
      const zt = router.ztIp || router.remoteIp || (router.ip && (router.ip.startsWith('10.') || router.ip.startsWith('172.')) ? router.ip : '');
      const local = (router.ip && !router.ip.startsWith('10.') && !router.ip.startsWith('172.')) ? router.ip : (router.ip || '192.168.88.1');
      setRemoteIp(zt);
      setLocalIp(local);
      setPassword(router.password || '');
      // Si une IP ZeroTier est présente, sélectionner 'remote' ou 'auto'
      setConnectionMode(zt ? 'remote' : 'auto');
      setInjectSuccess(null);
      setInjectError(null);
      setInjectTip(null);
      setDeviceNotice(null);
    } else {
      setAgentKey('');
      setCopied(false);
      setCopiedOneLiner(false);
      setError('');
      setInjectSuccess(null);
      setInjectError(null);
      setInjectTip(null);
      setDeviceNotice(null);
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

  const handleInject = async () => {
    try {
      setInjecting(true);
      setInjectSuccess(null);
      setInjectError(null);
      setInjectTip(null);
      setDeviceNotice(null);

      let targetIp = null;
      if (connectionMode === 'remote') {
        targetIp = remoteIp ? remoteIp.trim() : null;
        if (!targetIp) {
          throw { message: "Veuillez renseigner l'adresse IP ZeroTier / VPN du routeur." };
        }
      } else if (connectionMode === 'local') {
        targetIp = localIp ? localIp.trim() : null;
        if (!targetIp) {
          throw { message: "Veuillez renseigner l'adresse IP locale du routeur." };
        }
      }

      // Passerelle locale intelligente : si l'app tourne sur un cloud distant (Render/Vercel)
      // et que l'utilisateur a son backend local démarré sur son PC (qui est connecté à ZeroTier),
      // on utilise localhost:3001 pour injecter directement sans blocage réseau !
      let targetBaseUrl = BASE_URL;
      if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
        try {
          const probe = await fetch('http://localhost:3001/', { signal: AbortSignal.timeout(1200) });
          if (probe.ok) {
            targetBaseUrl = 'http://localhost:3001';
            console.log('⚡ Pont local actif : injection via localhost:3001');
          }
        } catch (_) {}
      }

      const res = await fetch(`${targetBaseUrl}/api/agent/inject/${router.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: connectionMode,
          targetIp: targetIp || undefined,
          password: password || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw { message: data.error || 'Erreur lors de l\'injection', tip: data.tip };
      }

      setInjectSuccess(data.message || 'Script et Scheduler installés avec succès !');
      if (data.deviceModeNotice) {
        setDeviceNotice(data.deviceModeNotice);
      }
    } catch (err) {
      setInjectError(err.message || 'Impossible d\'injecter le script automatiquement.');
      setInjectTip(err.tip || null);
    } finally {
      setInjecting(false);
    }
  };



  const handleCopy = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyOneLiner = () => {
    navigator.clipboard.writeText(oneLinerCommand);
    setCopiedOneLiner(true);
    setTimeout(() => setCopiedOneLiner(false), 2000);
  };

  if (!isOpen || !router) return null;

  // Si BASE_URL pointe vers localhost, utiliser l'URL publique de Render pour le script MikroTik
  const backendHost = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1') 
      ? 'https://mikrotik-hotspot-saas-1.onrender.com' 
      : BASE_URL;

  const oneLinerCommand = `/tool fetch url="${backendHost}/api/agent/install-script/${router.id}?key=${agentKey}" dst-path=agent-setup.rsc; :delay 2s; /import agent-setup.rsc; /file remove agent-setup.rsc`;

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
      
      <div className="glass-card w-full max-w-2xl relative overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[92vh] border border-white/10 shadow-2xl">
        {/* En-tête */}
        <div className="bg-primary/10 p-5 flex items-center justify-between border-b border-primary/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Zap size={20} className="fill-primary/20" />
            </div>
            <div>
              <h3 className="text-lg font-heading font-extrabold uppercase tracking-wide">
                Agent Push MikroTik
              </h3>
              <p className="text-xs text-white/50 font-mono flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-white/80 font-bold">{router.name}</span>
                <span>&bull;</span>
                <span>LAN: {router.ip || 'Non défini'}</span>
                {(router.ztIp || router.remoteIp) && (
                  <>
                    <span>&bull;</span>
                    <span className="text-emerald-400 font-semibold">ZT: {router.ztIp || router.remoteIp}</span>
                  </>
                )}
                <span>&bull;</span>
                <span>Port: {router.port || 8728}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Bloc 1 : Injection 1-Clic avec Sélecteur Local / ZeroTier */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/30 relative overflow-hidden shadow-lg space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-primary/20 text-primary uppercase tracking-wider">
                  Recommandé
                </span>
                <h4 className="font-bold text-white text-base">Injection Automatique en 1 Clic</h4>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Injecte le script et la tâche planifiée dans votre MikroTik via l'API ({router.port || 8728}). 
                Sélectionnez votre situation actuelle (à côté ou à distance) :
              </p>
            </div>

            {/* Sélecteur de mode : Auto vs À distance (VPN) vs À côté (Local) */}
            <div className="bg-black/40 p-3.5 rounded-xl border border-white/10 space-y-3">
              <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider block">
                Où êtes-vous par rapport au routeur ?
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setConnectionMode('auto')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    connectionMode === 'auto'
                      ? 'bg-primary/20 border-primary text-white shadow-sm ring-1 ring-primary/40'
                      : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={14} className={connectionMode === 'auto' ? 'text-primary' : 'text-white/40'} />
                    <span className="text-xs font-bold">Auto (IF)</span>
                  </div>
                  <p className="text-[10px] text-white/40 leading-snug">
                    Teste ZeroTier puis Réseau Local automatiquement
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionMode('remote')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    connectionMode === 'remote'
                      ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/40'
                      : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Globe size={14} className={connectionMode === 'remote' ? 'text-emerald-400' : 'text-white/40'} />
                    <span className="text-xs font-bold">À distance (VPN)</span>
                  </div>
                  <p className="text-[10px] text-white/40 leading-snug">
                    Via ZeroTier / WireGuard / IP Distante
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionMode('local')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    connectionMode === 'local'
                      ? 'bg-blue-500/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/40'
                      : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wifi size={14} className={connectionMode === 'local' ? 'text-blue-400' : 'text-white/40'} />
                    <span className="text-xs font-bold">À côté (Local)</span>
                  </div>
                  <p className="text-[10px] text-white/40 leading-snug">
                    Connecté au même Wi-Fi ou câble LAN
                  </p>
                </button>
              </div>

              {/* Champ d'IP si mode Distant (ZeroTier / VPN) sélectionné */}
              {connectionMode === 'remote' && (
                <div className="pt-2.5 border-t border-white/10 animate-in fade-in duration-200">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Globe size={13} />
                    Adresse IP ZeroTier / VPN du routeur :
                  </label>
                  <input
                    type="text"
                    className="input-glass w-full text-xs font-mono py-2"
                    placeholder="ex: 10.147.x.x (IP ZeroTier)"
                    value={remoteIp}
                    onChange={(e) => setRemoteIp(e.target.value)}
                  />
                  <p className="text-[10px] text-white/40 mt-1">
                    💡 Assurez-vous que votre PC/Appareil actuel est également connecté au même réseau ZeroTier/VPN.
                  </p>
                </div>
              )}

              {/* Champ d'IP si mode Local sélectionné */}
              {connectionMode === 'local' && (
                <div className="pt-2.5 border-t border-white/10 animate-in fade-in duration-200">
                  <label className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Wifi size={13} />
                    Adresse IP Locale du routeur :
                  </label>
                  <input
                    type="text"
                    className="input-glass w-full text-xs font-mono py-2"
                    placeholder="ex: 192.168.88.1"
                    value={localIp}
                    onChange={(e) => setLocalIp(e.target.value)}
                  />
                  <p className="text-[10px] text-white/40 mt-1">
                    💡 Votre appareil doit être connecté au même Wi-Fi ou switch réseau que le MikroTik.
                  </p>
                </div>
              )}

              {/* Résumé de l'ordre de test en mode Auto */}
              {connectionMode === 'auto' && (
                <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                  <span>Ordre de tentative :</span>
                  {remoteIp ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                      1. ZeroTier: {remoteIp}
                    </span>
                  ) : null}
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[10px]">
                    {remoteIp ? '2. Local: ' : '1. Local: '}{localIp || '192.168.88.1'}
                  </span>
                </div>
              )}
              {/* Champ Mot de passe du routeur */}
              <div className="pt-2.5 border-t border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert size={13} className="text-amber-400" />
                    Mot de passe API / Winbox du routeur :
                  </label>
                  <span className="text-[10px] text-white/40">Utilisateur: {router.login || 'admin'}</span>
                </div>
                <input
                  type="password"
                  className="input-glass w-full text-xs font-mono py-2"
                  placeholder="Mot de passe du MikroTik (ex: doul@2026)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-[10px] text-white/40 mt-1">
                  💡 Port API utilisé : {router.port || 8728}. Nécessaire pour injecter le script à distance via ZeroTier.
                </p>
              </div>
            </div>

            <button
              onClick={handleInject}
              disabled={injecting || loading || !router}
              className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-heading font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {injecting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Connexion & Injection en cours...</span>
                </>
              ) : (
                <>
                  <Zap size={18} className="fill-white" />
                  <span>
                    {connectionMode === 'remote' 
                      ? `⚡ Injecter via ZeroTier / VPN (${remoteIp || 'Non configurée'})` 
                      : connectionMode === 'local' 
                        ? `⚡ Injecter en Réseau Local (${localIp || '192.168.88.1'})`
                        : '⚡ Injecter maintenant (Détection Auto IF)'}
                  </span>
                </>
              )}
            </button>

            {/* Message de succès d'injection */}
            {injectSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-200">Injection réussie !</p>
                  <p className="text-emerald-300/90 mt-0.5">{injectSuccess}</p>
                </div>
              </div>
            )}

            {/* Avertissement RouterOS v7 device-mode */}
            {deviceNotice && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-300">
                <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-200">Mode Sécurité RouterOS v7 Détecté</p>
                  <p className="text-amber-200/80 leading-relaxed text-[11px]">{deviceNotice}</p>
                </div>
              </div>
            )}

            {/* Message d'erreur d'injection */}
            {injectError && (
              <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-red-200">{injectError}</p>
                  {injectTip && (
                    <p className="text-red-300/80 leading-relaxed text-[11px] bg-red-950/40 p-2 rounded-lg border border-red-500/20">
                      💡 {injectTip}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bloc 2 : Commande Terminal 1-Ligne (Sans ouvrir Winbox) */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-primary" />
                <h4 className="font-heading font-bold text-xs text-white/90 uppercase tracking-wider">
                  Alternative : Commande Terminal en 1 ligne
                </h4>
              </div>
              <button
                onClick={handleCopyOneLiner}
                disabled={loading || !agentKey}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition-all text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
              >
                {copiedOneLiner ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} />}
                <span>{copiedOneLiner ? 'Copié !' : 'Copier la commande'}</span>
              </button>
            </div>
            <p className="text-[11px] text-white/50">
              Collez cette unique ligne dans le terminal SSH ou WebFig de votre MikroTik. Elle télécharge, installe et lance tout automatiquement :
            </p>
            <div className="p-3 rounded-lg bg-black/60 border border-white/10 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all whitespace-pre-wrap">
              {loading ? 'Chargement...' : oneLinerCommand}
            </div>
          </div>

          {/* Bloc 3 : Accordéon pour voir le script complet */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
            <button
              onClick={() => setShowFullScript(!showFullScript)}
              className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Server size={15} className="text-white/40" />
                <span>Voir le script complet (Installation manuelle)</span>
              </div>
              {showFullScript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showFullScript && (
              <div className="p-4 border-t border-white/10 space-y-3 bg-black/30">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50">Code source du script agent-push</span>
                  <button
                    onClick={handleCopy}
                    disabled={loading || !agentKey}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-bold text-white/80"
                  >
                    {copied ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} />}
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black/60 border border-white/10 text-white/70 font-mono text-[10px] overflow-x-auto max-h-60 leading-relaxed whitespace-pre-wrap">
                  {loading ? 'Génération...' : scriptContent}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TunnelModal;