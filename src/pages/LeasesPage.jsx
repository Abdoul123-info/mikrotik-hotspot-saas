import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smartphone, Monitor, Radio, Wifi, Search, 
  RefreshCw, Server, Info, Signal, Activity,
  Database, HardDrive, Cpu, Terminal
} from 'lucide-react';
import { useRouter } from '../contexts/RouterContext';
import { getDhcpLeases, getWirelessClients, getNeighbors } from '../api/mikrotik.real';
import { detectDevice } from '../utils/deviceDetect';

function LeasesPage() {
  const { activeRouter } = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [leases, setLeases] = useState([]);
  const [wirelessClients, setWirelessClients] = useState([]);
  const [neighbors, setNeighbors] = useState([]);
  const [lastSync, setLastSync] = useState(new Date());

  const fetchData = async () => {
    if (!activeRouter) return;
    try {
      setLoading(true);
      const [lData, wData, nData] = await Promise.all([
        getDhcpLeases(activeRouter),
        getWirelessClients(activeRouter),
        getNeighbors(activeRouter)
      ]);
      setLeases(lData);
      setWirelessClients(wData);
      setNeighbors(nData);
      setLastSync(new Date());
    } catch (err) {
      console.error('Lease fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, [activeRouter]);

  // Logic to identify special devices (Antennas, Routers)
  const getDeviceType = (hostname, identity, platform) => {
    const text = `${hostname} ${identity} ${platform}`.toLowerCase();
    if (text.includes('nanostation') || text.includes('litebeam') || text.includes('powerbeam') || text.includes('ubnt') || text.includes('airmax')) {
      return { type: 'antenna', icon: <Radio size={16} />, label: 'Ubiquiti', color: 'text-primary bg-primary/10 border-primary/20' };
    }
    if (text.includes('mikrotik') || text.includes('lhg') || text.includes('sxt')) {
      return { type: 'antenna', icon: <Radio size={16} />, label: 'MikroTik', color: 'text-primary bg-primary/10 border-primary/20' };
    }
    const standard = detectDevice(hostname, '');
    if (standard.type === 'mobile') return { type: 'mobile', icon: <Smartphone size={16} />, label: standard.label, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    if (standard.type === 'pc') return { type: 'pc', icon: <Monitor size={16} />, label: standard.label, color: 'text-green-400 bg-green-500/10 border-green-500/20' };
    
    return { type: 'unknown', icon: <Smartphone size={16} />, label: 'Appareil', color: 'text-white/40 bg-white/5 border-white/10' };
  };

  // Cross-reference data
  const consolidated = useMemo(() => {
    return leases.map(l => {
      const wireless = wirelessClients.find(w => w.macAddress.toUpperCase() === l.macAddress.toUpperCase());
      const neighbor = neighbors.find(n => n.macAddress.toUpperCase() === l.macAddress.toUpperCase());
      const device = getDeviceType(l.hostname, neighbor?.identity, neighbor?.platform);

      return {
        ...l,
        wireless,
        neighbor,
        device
      };
    }).sort((a, b) => b.status === 'bound' ? 1 : -1);
  }, [leases, wirelessClients, neighbors]);

  const filtered = consolidated.filter(item => 
    item.address.includes(searchTerm) || 
    item.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.hostname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSignalColor = (dbm) => {
    const val = parseInt(dbm);
    if (val >= -60) return 'text-green-400';
    if (val >= -70) return 'text-yellow-400';
    if (val >= -80) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white flex items-center gap-3">
            <HardDrive className="text-primary" />
            Appareils & Antennes
          </h1>
          <p className="text-white/40 font-body mt-1 flex items-center gap-2">
            Liste des baux DHCP et monitoring du signal sans-fil
            <span className="w-1 h-1 rounded-full bg-white/20" />
            MAJ: {lastSync.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="IP, MAC ou NOM..."
              className="bg-white/[0.03] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={fetchData} disabled={loading}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-xl transition-all disabled:opacity-50">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 border-primary/10">
          <p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">Connectés</p>
          <p className="text-3xl font-heading font-black text-white">{consolidated.filter(l => l.status === 'bound').length}</p>
        </div>
        <div className="glass-card p-4 border-blue-500/10">
          <p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">Mobiles</p>
          <p className="text-3xl font-heading font-black text-blue-400">{consolidated.filter(l => l.device.type === 'mobile').length}</p>
        </div>
        <div className="glass-card p-4 border-green-500/10">
          <p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">Antennes / PC</p>
          <p className="text-3xl font-heading font-black text-green-400">{consolidated.filter(l => l.device.type !== 'mobile').length}</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="neon-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-[9px] font-heading font-black uppercase tracking-[0.2em] text-white/20">
                <th className="px-5 py-4">Appareil</th>
                <th className="px-5 py-4">IP / MAC</th>
                <th className="px-5 py-4 text-center">Signal / WiFi</th>
                <th className="px-5 py-4 text-center">CCQ %</th>
                <th className="px-5 py-4">Statut</th>
                <th className="px-5 py-4 text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-primary/[0.02] transition-colors group">
                    {/* Appareil */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black transition-all ${item.device.color}`}>
                          {item.device.icon}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white group-hover:text-primary transition-colors">
                            {item.hostname || item.neighbor?.identity || '---'}
                          </p>
                          <p className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">
                            {item.device.label} {item.neighbor?.board ? `(${item.neighbor.board})` : ''}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* IP / MAC */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5 font-mono text-xs">
                        <span className="text-white/60">{item.address}</span>
                        <span className="text-[9px] text-white/20">{item.macAddress}</span>
                      </div>
                    </td>

                    {/* Signal */}
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      {item.wireless ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-black font-mono ${getSignalColor(item.wireless.signal)}`}>
                            {item.wireless.signal} dBm
                          </span>
                          <span className="text-[8px] text-white/30 uppercase font-bold tracking-widest flex items-center gap-1">
                            <Activity size={8} /> {item.wireless.throughput}
                          </span>
                        </div>
                      ) : (
                        <span className="text-white/10 text-[10px] italic">Filaire / Autre</span>
                      )}
                    </td>

                    {/* CCQ */}
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      {item.wireless && item.wireless.txCcq ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${item.wireless.txCcq}%` }} />
                          </div>
                          <span className="text-[10px] font-black text-primary">{item.wireless.txCcq}%</span>
                        </div>
                      ) : (
                        <span className="text-white/5">---</span>
                      )}
                    </td>

                    {/* Statut */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border
                        ${item.status === 'bound' 
                          ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                          : 'bg-white/5 border-white/10 text-white/20'}`}>
                        {item.status === 'bound' ? 'Relié (Actif)' : item.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      {item.comment && (
                        <span className="text-[10px] text-white/30 italic mr-2">{item.comment}</span>
                      )}
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5 text-[9px] text-white/30 font-mono">
                         {item.lastSeen || 'Stable'}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-white/10 italic text-xs uppercase font-black tracking-widest">
                    {loading ? 'Analyse du réseau...' : 'Aucun appareil détecté'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pro-Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
             <Signal size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-white mb-1 uppercase tracking-tight">Qualité de Signal</p>
            <p className="text-xs text-white/40 leading-relaxed">
              Pour une antenne stable, visez un signal entre <span className="text-green-400 font-bold">-45 et -65 dBm</span>. 
              Au-delà de -75 dBm, la connexion risque de couper ou d'être lente.
            </p>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
             <Activity size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-white mb-1 uppercase tracking-tight">Performance CCQ</p>
            <p className="text-xs text-white/40 leading-relaxed">
              Le CCQ indique la stabilité de la transmission WiFi. S'il est <span className="text-primary font-bold">inférieur à 80%</span>, 
              vérifiez les obstacles physiques ou les interférences sur le canal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeasesPage;
