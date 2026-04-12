import React, { useState, useEffect } from 'react';
import { useRouter } from '../contexts/RouterContext';
import { getFullActiveUsers, disconnectActiveUser, blockHotspotUser, getHotspotUserDetails } from '../api/mikrotik.real';
import { UserMinus, RefreshCcw, Wifi, Clock, Search, ShieldOff, Shield, X, HardDrive, User, Layers } from 'lucide-react';

// --- Panneau de détails utilisateur ---
function UserDetailsPanel({ user, router, onClose, onBlock }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      const data = await getHotspotUserDetails(router, user.user);
      setDetails(data);
      setLoading(false);
    };
    fetchDetails();
  }, [user.user, router]);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleBlock = async (block) => {
    setBlocking(true);
    await onBlock(user.id, user.user, block);
    setBlocking(false);
    onClose();
  };

  const isBlocked = details?.disabled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass-card p-6 rounded-2xl border border-white/10 space-y-5 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-bg-dark text-sm ${isBlocked ? 'bg-red-500' : 'bg-primary'}`}>
              {user.user.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-heading font-bold text-white">{user.user}</h2>
              {isBlocked && <span className="text-xs text-red-400 font-bold">🔒 BLOQUÉ</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Session Active Info */}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-white/30 font-heading">Session Active</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoItem icon={<Wifi size={14} />} label="Adresse IP" value={user.address || '---'} />
                <InfoItem icon={<HardDrive size={14} />} label="MAC" value={user.macAddress || '---'} mono />
                <InfoItem icon={<Clock size={14} />} label="Uptime" value={user.uptime} />
                <InfoItem icon={<User size={14} />} label="Via" value={user.loginBy || 'hotspot'} />
              </div>
            </div>

            {/* Traffic */}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-white/30 font-heading">Trafic</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-500/10 rounded-xl p-3 text-center border border-blue-500/20">
                  <p className="text-[10px] text-white/40 mb-1">⬆ Envoyé</p>
                  <p className="text-sm font-bold text-blue-400">{formatBytes(user.bytesOut)}</p>
                </div>
                <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
                  <p className="text-[10px] text-white/40 mb-1">⬇ Reçu</p>
                  <p className="text-sm font-bold text-green-400">{formatBytes(user.bytesIn)}</p>
                </div>
              </div>
            </div>

            {/* Profile Info */}
            {details && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-white/30 font-heading">Profil & Limites</p>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem icon={<Layers size={14} />} label="Profil" value={details.profile || '---'} />
                  <InfoItem icon={<Clock size={14} />} label="Limite temps" value={details.limitUptime} />
                  <InfoItem icon={<HardDrive size={14} />} label="Limite data" value={details.limitBytes} />
                  <InfoItem icon={<User size={14} />} label="Commentaire" value={details.comment || '---'} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {isBlocked ? (
                <button
                  onClick={() => handleBlock(false)}
                  disabled={blocking}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500/10 hover:bg-green-500 border border-green-500/30 text-green-400 hover:text-white rounded-xl transition-all font-bold"
                >
                  <Shield size={18} />
                  {blocking ? 'En cours...' : 'Débloquer'}
                </button>
              ) : (
                <button
                  onClick={() => handleBlock(true)}
                  disabled={blocking}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500/10 hover:bg-orange-500 border border-orange-500/30 text-orange-400 hover:text-white rounded-xl transition-all font-bold"
                >
                  <ShieldOff size={18} />
                  {blocking ? 'En cours...' : 'Bloquer'}
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
    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-1.5 text-white/30 mb-1">
        {icon}
        <p className="text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-sm text-white font-medium truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

// --- Page principale ---
function ActiveUsersPage() {
  const { activeRouter } = useRouter();
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchData = async () => {
    if (!activeRouter) return;
    try {
      setLoading(true);
      const data = await getFullActiveUsers(activeRouter);
      setActiveUsers(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [activeRouter]);

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

  const filteredUsers = activeUsers.filter(u =>
    u.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.address.includes(searchTerm) ||
    u.macAddress.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Details Modal */}
      {selectedUser && (
        <UserDetailsPanel
          user={selectedUser}
          router={activeRouter}
          onClose={() => setSelectedUser(null)}
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
          <p className="text-white/40 font-body mt-1">
            Surveillance en temps réel · {activeRouter?.name || '---'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono text-white/60">MàJ: {lastUpdated.toLocaleTimeString()}</span>
          </div>
          <button onClick={fetchData} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/60 hover:text-white">
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="glass-card p-4 flex items-center gap-4 w-fit">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
          <Wifi className="text-primary" size={24} />
        </div>
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider">Connectés</p>
          <p className="text-2xl font-heading font-bold text-white">{activeUsers.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-2 flex items-center gap-3">
        <Search className="text-white/20 ml-2" size={20} />
        <input
          type="text"
          placeholder="Rechercher par nom, IP ou MAC..."
          className="bg-transparent border-none text-white focus:ring-0 flex-1 py-2 font-body outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 text-xs font-heading font-bold uppercase tracking-wider text-white/40">Utilisateur</th>
                <th className="px-6 py-4 text-xs font-heading font-bold uppercase tracking-wider text-white/40">IP</th>
                <th className="px-6 py-4 text-xs font-heading font-bold uppercase tracking-wider text-white/40">MAC</th>
                <th className="px-6 py-4 text-xs font-heading font-bold uppercase tracking-wider text-white/40">Uptime</th>
                <th className="px-6 py-4 text-xs font-heading font-bold uppercase tracking-wider text-white/40">Trafic ↑↓</th>
                <th className="px-6 py-4 text-xs font-heading font-bold uppercase tracking-wider text-white/40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-bg-dark text-xs">
                          {user.user.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{user.user}</p>
                          <p className="text-[10px] text-white/40">{user.loginBy || 'Session'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60 font-mono">{user.address}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60 font-mono text-xs">{user.macAddress}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-primary/40" />
                        {user.uptime}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{formatBytes(user.bytesOut)}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{formatBytes(user.bytesIn)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleBlock(user.id, user.user, true)}
                          className="p-2 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white rounded-lg transition-all"
                          title="Bloquer"
                        >
                          <ShieldOff size={16} />
                        </button>
                        <button
                          onClick={() => handleDisconnect(user.id, user.user)}
                          className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                          title="Déconnecter"
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-white/20 italic">
                    {loading ? 'Chargement des sessions...' : 'Aucun utilisateur actif trouvé.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-white/5 text-xs text-white/20">
          Cliquez sur une ligne pour voir les détails · Rafraîchissement toutes les 15s
        </div>
      </div>
    </div>
  );
}

export default ActiveUsersPage;
