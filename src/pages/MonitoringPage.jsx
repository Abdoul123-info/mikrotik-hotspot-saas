import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Users, 
  Wifi, 
  Server,
  Zap,
  RefreshCw
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { getMonitoringSnapshot, getActiveHotspotUsers } from '../api/mikrotik.real';
import { useRouter } from '../contexts/RouterContext';

function MonitoringPage() {
  const { activeRouter } = useRouter();
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!activeRouter) return;

    const fetchSnapshot = async () => {
      const sample = await getMonitoringSnapshot(activeRouter);
      if (sample) {
        setMetrics(sample);
        setData(prev => [...prev.slice(-30), {
          time: sample.timestamp,
          tx: sample.txBps / 1024, 
          rx: sample.rxBps / 1024,
          cpu: sample.cpuPercent,
          ram: sample.ramPercent
        }]);
      }
    };

    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 5000);

    return () => clearInterval(interval);
  }, [activeRouter]);

  return (
    <div className="space-y-8 animate-in zoom-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white">Monitoring Réel</h1>
          <p className="text-white/40 font-body">Données en direct du routeur : {activeRouter?.name || 'Non sélectionné'}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl text-primary text-xs font-bold uppercase tracking-wider">
          <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
          Live REST API
        </div>
      </header>

      {!activeRouter ? (
        <div className="glass-card p-20 flex flex-col items-center gap-4 text-center">
            <Wifi size={48} className="text-white/10" />
            <p className="text-white/40 font-bold uppercase tracking-widest">Aucun routeur sélectionné</p>
            <p className="text-xs text-white/20">Veuillez sélectionner un routeur dans la barre supérieure.</p>
        </div>
      ) : (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 border border-primary/20">
                        <Cpu size={32} />
                    </div>
                    <h4 className="text-white/40 text-xs uppercase font-heading font-bold mb-1 tracking-widest">Charge CPU</h4>
                    <p className="text-4xl font-heading font-black">{metrics?.cpuPercent || 0}%</p>
                </div>

                <div className="glass-card p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary mb-4 border border-secondary/20">
                        <HardDrive size={32} />
                    </div>
                    <h4 className="text-white/40 text-xs uppercase font-heading font-bold mb-1 tracking-widest">Mémoire RAM</h4>
                    <p className="text-4xl font-heading font-black">{metrics?.ramPercent || 0}%</p>
                </div>

                <div className="glass-card p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-4 border border-accent/20">
                        <Users size={32} />
                    </div>
                    <h4 className="text-white/40 text-xs uppercase font-heading font-bold mb-1 tracking-widest">En ligne (Hotspot)</h4>
                    <p className="text-4xl font-heading font-black">{metrics?.activeUsers || 0}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bandwidth Chart */}
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-heading font-bold flex items-center gap-2">
                            <Zap size={18} className="text-primary" /> Trafic Réseau (kbps)
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00E5A0" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#00E5A0" stopOpacity={0}/>
                                  </linearGradient>
                                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#0066FF" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="time" hide />
                                <YAxis stroke="#ffffff20" fontSize={12} />
                                <Tooltip contentStyle={{ backgroundColor: '#151921', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                                <Area type="monotone" dataKey="rx" stroke="#00E5A0" strokeWidth={3} fillOpacity={1} fill="url(#colorRx)" />
                                <Area type="monotone" dataKey="tx" stroke="#0066FF" strokeWidth={3} fillOpacity={1} fill="url(#colorTx)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* System Stats Chart */}
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-heading font-bold flex items-center gap-2">
                            <RefreshCw size={18} className="text-secondary" /> Ressources (%)
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="time" hide />
                                <YAxis stroke="#ffffff20" fontSize={12} domain={[0, 100]} />
                                <Tooltip contentStyle={{ backgroundColor: '#151921', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                                <Area type="monotone" dataKey="cpu" stroke="#00E5A0" strokeWidth={2} fill="#00E5A010" />
                                <Area type="monotone" dataKey="ram" stroke="#FF6B35" strokeWidth={2} fill="#FF6B3510" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
}

export default MonitoringPage;
