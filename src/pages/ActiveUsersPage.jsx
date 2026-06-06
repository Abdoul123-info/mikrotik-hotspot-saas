import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from '../contexts/RouterContext';
import { getFullActiveUsers, disconnectActiveUser, blockHotspotUser, getHotspotUserDetails, getVoucherProfiles } from '../api/mikrotik.real';
import { detectDevice } from '../utils/deviceDetect';
import { UserMinus, RefreshCcw, Wifi, Clock, Search, ShieldOff, Shield, X, HardDrive, Layers, Zap, Moon, AlertTriangle, Smartphone, Monitor, Eye } from 'lucide-react';

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const parseUptimeToSeconds = (uptime) => {
  if (!uptime) return 0;
  let total = 0;
  const d = uptime.match(/(\d+)d/); if (d) total += parseInt(d[1]) * 86400;
  const h = uptime.match(/(\d+)h/); if (h) total += parseInt(h[1]) * 3600;
  const m = uptime.match(/(\d+)m/); if (m) total += parseInt(m[1]) * 60;
  const s = uptime.match(/(\d+)s/); if (s) total += parseInt(s[1]);
  return total;
};

const formatSeconds = (secs) => {
  if (!secs || secs <= 0) return '---';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const getTimePercent = (sessionTimeLeft, uptime) => {
  const leftSecs = parseUptimeToSeconds(sessionTimeLeft);
  const usedSecs = parseUptimeToSeconds(uptime);
  const total = leftSecs + usedSecs;
  if (total === 0) return null;
  return Math.round((leftSecs / total) * 100);
};

const getIdleSecs = (idleTime) => parseUptimeToSeconds(idleTime);

// ─── Barre de temps restant ──────────────────────────────────────────────────

function TimeBar({ sessionTimeLeft, uptime }) {
  if (!sessionTimeLeft) return (
    <span className="text-[10px] text-white/20 font-mono italic">Illimité</span>
  );
  const leftSecs = parseUptimeToSeconds(sessionTimeLeft);
  const pct = getTimePercent(sessionTimeLeft, uptime);
  const color = pct > 50 ? 'bg-primary' : pct > 20 ? 'bg-orange-400' : 'bg-red-500';
  const textColor = pct > 50 ? 'text-primary' : pct > 20 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="flex flex-col gap-1.5 min-w-[110px]">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-black font-mono ${textColor}`}>
          {formatSeconds(leftSecs)} restant
        </span>
        {pct !== null && <span className={`text-[9px] ${textColor}`}>{pct}%</span>}
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden w-full">
        <div className={`h-full ${color} rounded-full transition-all duration-1000`}
          style={{ width: `${pct ?? 100}%` }} />
      </div>
    </div>
  );
}

// ─── Badge appareil (Mobile / PC) ────────────────────────────────────────────

function DeviceBadge({ hostname, macAddress, size = 'sm' }) {
  const dev = detectDevice(hostname, macAddress);
  if (dev.type === 'unknown') return null;

  const isMobile = dev.type === 'mobile';
  const bg = isMobile ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-blue-500/10 border-blue-500/20 text-blue-400';

  if (size === 'lg') {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${bg}`}>
        {isMobile ? <Smartphone size={16} /> : <Monitor size={16} />}
        <div>
          <p className="text-xs font-black">{dev.label}</p>
          {hostname && <p className="text-[9px] opacity-60 font-mono truncate max-w-[120px]">{hostname}</p>}
        </div>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wide ${bg}`}>
      {isMobile ? <Smartphone size={9} /> : <Monitor size={9} />}
      {dev.label}
    </span>
  );
}

// ─── Badges statut ────────────────────────────────────────────────────────────

function StatusBadges({ user }) {
  const badges = [];
  const idleSecs = getIdleSecs(user.idleTime);
  const totalBytes = user.bytesIn + user.bytesOut;
  const uptimeSecs = parseUptimeToSeconds(user.uptime);

  if (idleSecs > 600) {
    badges.push(
      <span key="zombie" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase">
        <Moon size={9} /> Zombie
      </span>
    );
  }

  if (user.sessionTimeLeft) {
    const leftSecs = parseUptimeToSeconds(user.sessionTimeLeft);
    if (leftSecs > 0 && leftSecs < 300) {
      badges.push(
        <span key="expiring" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase animate-pulse">
          <AlertTriangle size={9} /> Expire bientôt
        </span>
      );
    }
  }

  if (uptimeSecs > 60 && totalBytes > 0) {
    const avgMbps = (totalBytes * 8) / uptimeSecs / 1_000_000;
    if (avgMbps > 2) {
      badges.push(
        <span key="abuser" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-black uppercase">
          <Zap size={9} /> Abuseur
        </span>
      );
    }
  }

  return badges.length > 0 ? <div className="flex flex-wrap gap-1 mt-1">{badges}</div> : null;
}

// ─── Panneau de détails ───────────────────────────────────────────────────────

function UserDetailsPanel({ user, router, onClose, onBlock }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      const data = await getHotspotUserDetails(router, user.user);
      setDetails(data);
      setLoading(false);
    };
    fetch_();
  }, [user.user, router]);

  const handleBlock = async (block) => {
    setBlocking(true);
    await onBlock(user.id, user.user, block);
    setBlocking(false);
    onClose();
  };

  const isBlocked = details?.disabled;
  const idleSecs = getIdleSecs(user.idleTime);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md neon-card p-6 space-y-5 z-10" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${isBlocked ? 'bg-red-500 text-white' : 'bg-primary text-bg-dark'}`}>
              {user.user.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-heading font-black text-white">{user.user}</h2>
              <div className="flex gap-2 flex-wrap items-center mt-0.5">
                {isBlocked && <span className="text-xs text-red-400 font-bold">🔒 BLOQUÉ</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/30 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Appareil détecté — affiché en haut, bien visible */}
            <div className="flex items-center gap-3">
              <DeviceBadge hostname={user.hostname} macAddress={user.macAddress} size="lg" />
              <StatusBadges user={user} />
            </div>

            {/* Temps restant */}
            {user.sessionTimeLeft && (
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3 font-black">⏱ Temps Restant</p>
                <TimeBar sessionTimeLeft={user.sessionTimeLeft} uptime={user.uptime} />
                <div className="mt-2 flex justify-between text-[9px] text-white/20 font-mono">
                  <span>Connecté : {user.uptime}</span>
                  {idleSecs > 60 && <span className="text-blue-400">💤 Inactif : {formatSeconds(idleSecs)}</span>}
                </div>
              </div>
            )}

            {/* Réseau */}
            <div className="grid grid-cols-2 gap-3">
              <InfoItem icon={<Wifi size={14} />} label="Adresse IP" value={user.address || '---'} />
              <InfoItem icon={<HardDrive size={14} />} label="MAC" value={user.macAddress || '---'} mono />
              <InfoItem icon={<Clock size={14} />} label="Uptime" value={user.uptime} />
              <InfoItem icon={<Clock size={14} />} label="Inactivité" value={idleSecs > 0 ? formatSeconds(idleSecs) : '---'} />
            </div>

            {/* Trafic */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-500/5 rounded-xl p-3 text-center border border-blue-500/10">
                <p className="text-[10px] text-white/30 mb-1">⬆ Upload</p>
                <p className="text-sm font-black text-blue-400">{formatBytes(user.bytesOut)}</p>
              </div>
              <div className="bg-green-500/5 rounded-xl p-3 text-center border border-green-500/10">
                <p className="text-[10px] text-white/30 mb-1">⬇ Download</p>
                <p className="text-sm font-black text-green-400">{formatBytes(user.bytesIn)}</p>
              </div>
            </div>

            {/* Profil */}
            {details && (
              <div className="grid grid-cols-2 gap-3">
                <InfoItem icon={<Layers size={14} />} label="Profil" value={details.profile || '---'} />
                <InfoItem icon={<Clock size={14} />} label="Durée forfait" value={details.limitUptime} />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {isBlocked ? (
                <button onClick={() => handleBlock(false)} disabled={blocking}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500/10 hover:bg-green-500 border border-green-500/20 text-green-400 hover:text-white rounded-xl transition-all font-black text-sm">
                  <Shield size={16} /> {blocking ? 'En cours...' : 'Débloquer'}
                </button>
              ) : (
                <button onClick={() => handleBlock(true)} disabled={blocking}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500/10 hover:bg-orange-500 border border-orange-500/20 text-orange-400 hover:text-white rounded-xl transition-all font-black text-sm">
                  <ShieldOff size={16} /> {blocking ? 'En cours...' : 'Bloquer'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value, mono }) {
  return (
    <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-1.5 text-white/20 mb-1">
        {icon}
        <p className="text-[9px] uppercase tracking-wider font-black">{label}</p>
      </div>
      <p className={`text-sm text-white font-bold truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

function ActiveUsersPage() {
  const { activeRouter } = useRouter();
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedUserName, setSelectedUserName] = useState(null);
  const [filterMode, setFilterMode] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');
  const [allProfiles, setAllProfiles] = useState([]); // Liste complète des profils du routeur

  const fetchData = async () => {
    if (!activeRouter) return;
    try {
      setLoading(true);
      const [data, profiles] = await Promise.all([
        getFullActiveUsers(activeRouter),
        getVoucherProfiles(activeRouter)
      ]);
      setActiveUsers(data || []);
      setAllProfiles(profiles || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setActiveUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // On ne rafraîchit pas si un utilisateur est sélectionné pour éviter de fermer/bugger le panel
    if (selectedUserName) return; 

    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [activeRouter, selectedUserName]);

  const handleDisconnect = async (id, name) => {
    if (!window.confirm(`Déconnecter "${name}" ?`)) return;
    const res = await disconnectActiveUser(activeRouter, id);
    if (res.success) setActiveUsers(prev => prev.filter(u => u.id !== id));
    else alert('Erreur: ' + res.error);
  };

  const handleBlock = async (sessionId, username, block) => {
    const res = await blockHotspotUser(activeRouter, username, block, block ? sessionId : null);
    if (res.success) {
      if (block) setActiveUsers(prev => prev.filter(u => u.id !== sessionId));
    } else {
      alert('Erreur: ' + res.error);
    }
  };

  // ── Statistiques ──
  const zombies = activeUsers.filter(u => getIdleSecs(u.idleTime) > 600).length;
  const totalDownload = activeUsers.reduce((acc, u) => acc + u.bytesOut, 0); // Utilise bytesOut pour le Download

  // Comptage Mobile / PC par hostname+MAC
  const mobileCount = activeUsers.filter(u => detectDevice(u.hostname, u.macAddress).type === 'mobile').length;
  const pcCount     = activeUsers.filter(u => detectDevice(u.hostname, u.macAddress).type === 'pc').length;

  // ── Filtrage Catégories + Profil + Tri (Mémorisé) ──
  const filtered = useMemo(() => {
    let result = activeUsers.filter(u =>
      (u.user || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.address || '').includes(searchTerm) ||
      (u.macAddress || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filtre par profil
    if (profileFilter !== 'all') {
      result = result.filter(u => u.profile === profileFilter);
    }

    if (filterMode === 'bytes') {
      result = result.filter(u => {
        const uptimeSecs = parseUptimeToSeconds(u.uptime);
        const totalBytes = u.bytesIn + u.bytesOut;
        return uptimeSecs > 60 && ((totalBytes * 8) / uptimeSecs / 1_000_000) > 2;
      }).sort((a, b) => (b.bytesIn + b.bytesOut) - (a.bytesIn + a.bytesOut));
    } else if (filterMode === 'idle') {
      result = result.filter(u => getIdleSecs(u.idleTime) > 600)
        .sort((a, b) => getIdleSecs(b.idleTime) - getIdleSecs(a.idleTime));
    } else if (filterMode === 'uptime') {
      result = result.filter(u => parseUptimeToSeconds(u.uptime) > 3600)
        .sort((a, b) => parseUptimeToSeconds(b.uptime) - parseUptimeToSeconds(a.uptime));
    } else {
      result = [...result].sort((a, b) => parseUptimeToSeconds(b.uptime) - parseUptimeToSeconds(a.uptime));
    }
    return result;
  }, [activeUsers, searchTerm, filterMode, profileFilter]);

  // Trouver l'utilisateur sélectionné dans la liste actuelle
  const selectedUser = useMemo(() => 
    activeUsers.find(u => u.user === selectedUserName),
    [activeUsers, selectedUserName]
  );

  return (
    <div className="space-y-6">
      {/* Modal - On passe selectedUserName ou selectedUser */}
      {selectedUserName && (
        <UserDetailsPanel
          user={selectedUser || { user: selectedUserName }} // Fallback minimal si non trouvé
          router={activeRouter}
          onClose={() => setSelectedUserName(null)}
          onBlock={handleBlock}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white flex items-center gap-3">
            <Wifi className="text-primary animate-pulse" />
            Utilisateurs Actifs
          </h1>
          <p className="text-white/40 font-body mt-1 text-sm">
            Surveillance temps réel · {activeRouter?.name || '---'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-mono text-white/50">MàJ: {lastUpdated.toLocaleTimeString()}</span>
          </div>
          <button onClick={fetchData} className="p-3 bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 rounded-xl transition-all text-white/60 hover:text-primary">
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Connectés */}
        <div className="neon-card p-4">
          <p className="text-[9px] text-white/30 uppercase font-black tracking-widest mb-1">Connectés</p>
          <p className="text-3xl font-heading font-black text-white">{activeUsers.length}</p>
        </div>

        {/* Zombies */}
        <div className={`neon-card p-4 ${zombies > 0 ? 'border-blue-500/30' : ''}`}>
          <p className="text-[9px] text-white/30 uppercase font-black tracking-widest mb-1">💤 Zombies</p>
          <p className={`text-3xl font-heading font-black ${zombies > 0 ? 'text-blue-400' : 'text-white'}`}>{zombies}</p>
        </div>

        {/* 📱 Mobiles vs 💻 PC */}
        <div className="neon-card p-4">
          <p className="text-[9px] text-white/30 uppercase font-black tracking-widest mb-2">Appareils</p>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-2xl font-heading font-black text-primary">{mobileCount}</p>
              <p className="text-[9px] text-primary/60 font-black flex items-center gap-1 justify-center">
                <Smartphone size={9} /> Mobile
              </p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-heading font-black text-blue-400">{pcCount}</p>
              <p className="text-[9px] text-blue-400/60 font-black flex items-center gap-1 justify-center">
                <Monitor size={9} /> PC
              </p>
            </div>
          </div>
        </div>

        {/* Download total */}
        <div className="neon-card p-4">
          <p className="text-[9px] text-white/30 uppercase font-black tracking-widest mb-1">⬇ Download total</p>
          <p className="text-xl font-heading font-black text-white">{formatBytes(totalDownload)}</p>
        </div>
      </div>

      {/* Recherche + Tri */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="neon-card p-2 flex items-center gap-3 border-white/5 bg-white/[0.01] flex-1">
          <Search className="text-white/20 ml-2" size={18} />
          <input
            type="text"
            placeholder="Rechercher par nom, IP ou MAC..."
            className="bg-transparent border-none text-white focus:ring-0 flex-1 py-1.5 font-body outline-none text-sm placeholder:text-white/10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex bg-white/5 rounded-xl border border-white/5 p-1 gap-1">
            <button onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filterMode === 'all' ? 'bg-primary text-bg-dark shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white'}`}>
              Tous
            </button>
            {[
              ['bytes', '⚡ Trafic'],
              ['idle', '💤 Inactifs'],
              ['uptime', '⏱ Durée']
            ].map(([key, label]) => (
              <button key={key} onClick={() => setFilterMode(key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filterMode === key ? 'bg-white/10 text-primary border border-white/10' : 'text-white/40 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Menu déroulant Profils */}
          <div className="relative flex items-center bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 gap-2 group hover:border-primary/30 transition-all">
            <Layers size={14} className="text-white/20 group-hover:text-primary transition-colors" />
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-wider text-white focus:ring-0 cursor-pointer outline-none min-w-[100px]"
            >
              <option value="all" className="bg-bg-dark text-white">Profil: TOUS</option>
              {allProfiles.map(p => (
                <option key={p.id} value={p.name} className="bg-bg-dark text-white">{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="neon-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-[9px] font-heading font-black uppercase tracking-[0.2em] text-white/20">
                <th className="px-5 py-4">Utilisateur</th>
                <th className="px-5 py-4">Appareil</th>
                <th className="px-5 py-4">IP / MAC</th>
                <th className="px-5 py-4">⏱ Temps restant</th>
                <th className="px-5 py-4">⬇⬆ Trafic</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.length > 0 ? (
                filtered.map((user) => {
                  const idleSecs = getIdleSecs(user.idleTime);
                  const isZombie = idleSecs > 600;
                  const leftSecs = parseUptimeToSeconds(user.sessionTimeLeft);
                  const isExpiring = user.sessionTimeLeft && leftSecs > 0 && leftSecs < 300;
                  const totalBytes = user.bytesIn + user.bytesOut;
                  const uptimeSecs = parseUptimeToSeconds(user.uptime);
                  const avgMbps = uptimeSecs > 60 ? (totalBytes * 8) / uptimeSecs / 1_000_000 : 0;
                  const dev = detectDevice(user.hostname, user.macAddress);

                  return (
                    <tr key={user.user}
                      className={`hover:bg-primary/[0.02] active:bg-primary/[0.05] transition-all cursor-pointer group ${isExpiring ? 'bg-red-500/[0.02]' : ''} ${selectedUserName === user.user ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                      onClick={() => setSelectedUserName(user.user)}>

                      {/* Utilisateur */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all flex-shrink-0
                            ${isZombie ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' :
                              isExpiring ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                              'bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary group-hover:text-bg-dark'}`}>
                            {user.user.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black text-white group-hover:text-primary transition-colors">{user.user}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-white/5 text-white/40 rounded-md border border-white/5 italic">
                                {user.profile}
                              </span>
                              <StatusBadges user={user} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Appareil : 📱 Mobile ou 💻 PC */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {dev.type === 'unknown' ? (
                          <span className="text-[9px] text-white/15 font-mono">---</span>
                        ) : (
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-black
                            ${dev.type === 'mobile'
                              ? 'bg-primary/10 border-primary/20 text-primary'
                              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                            {dev.type === 'mobile' ? <Smartphone size={12} /> : <Monitor size={12} />}
                            {dev.label}
                          </div>
                        )}
                        {user.hostname && (
                          <p className="text-[9px] text-white/20 font-mono mt-0.5 max-w-[100px] truncate">{user.hostname}</p>
                        )}
                      </td>

                      {/* IP/MAC */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-white/60 font-mono">{user.address}</span>
                          <span className="text-[9px] text-white/20 font-mono">{user.macAddress}</span>
                        </div>
                      </td>

                      {/* Temps restant */}
                      <td className="px-5 py-4 whitespace-nowrap min-w-[140px]">
                        <TimeBar sessionTimeLeft={user.sessionTimeLeft} uptime={user.uptime} />
                        {idleSecs > 60 && (
                          <p className="text-[9px] text-blue-400/60 mt-1 font-mono">💤 inactif {formatSeconds(idleSecs)}</p>
                        )}
                      </td>

                      {/* Trafic */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2 text-[10px] font-mono text-green-400/70" title="Download">
                            <span className="w-1.5 h-0.5 bg-green-500 rounded-full" />⬇ {formatBytes(user.bytesOut)}
                          </span>
                          <span className="flex items-center gap-2 text-[10px] font-mono text-blue-400/70" title="Upload">
                            <span className="w-1.5 h-0.5 bg-blue-500 rounded-full" />⬆ {formatBytes(user.bytesIn)}
                          </span>
                          {avgMbps > 2 && (
                            <span className="text-[9px] text-orange-400 font-black">⚡ {avgMbps.toFixed(1)} Mbps moy.</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 text-white">
                          <button onClick={() => setSelectedUserName(user.user)}
                            className="p-2.5 bg-primary/10 hover:bg-primary border border-primary/20 hover:border-primary text-primary hover:text-bg-dark rounded-xl transition-all" title="Détails">
                            <Eye size={15} />
                          </button>
                          <button onClick={() => handleBlock(user.id, user.user, true)}
                            className="p-2.5 bg-white/5 hover:bg-orange-500 text-white/30 hover:text-white rounded-xl border border-white/5 transition-all" title="Bloquer">
                            <ShieldOff size={15} />
                          </button>
                          <button onClick={() => handleDisconnect(user.id, user.user)}
                            className="p-2.5 bg-white/5 hover:bg-red-500 text-white/30 hover:text-white rounded-xl border border-white/5 transition-all" title="Déconnecter">
                            <UserMinus size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-white/10 italic text-xs uppercase font-black tracking-widest">
                    {loading ? 'Scanning du réseau...' : 'Aucun utilisateur actif'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
          <span className="text-[9px] text-white/20 uppercase font-black tracking-widest">
            Auto-refresh 15s · {filtered.length} session(s)
          </span>
          <span className="text-[9px] text-primary/40 font-bold">LECTURE SEULE</span>
        </div>
      </div>
    </div>
  );
}

export default ActiveUsersPage;
