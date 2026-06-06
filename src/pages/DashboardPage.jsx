import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Wallet, 
  Ticket, 
  Wifi, 
  Activity, 
  TrendingUp, 
  ArrowRight,
  Clock,
  CircleDollarSign
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
import StatsCard from '../components/dashboard/StatsCard';
import { useSettings } from '../contexts/SettingsContext';
import { useSales } from '../contexts/SalesContext';
import { useRouter } from '../contexts/RouterContext';
import { formatCurrency } from '../utils/currency';
import { getMonitoringSnapshot } from '../api/mikrotik.real';
import { calculateMikhmonStats } from '../utils/sales';

function DashboardPage() {
  const { settings } = useSettings();
  const { activeRouter } = useRouter();
  const { sales, fetchSales, isLoading: isSalesLoading } = useSales();
  
  const [bandwidthData, setBandwidthData] = useState([]);
  const [activeUserCount, setActiveUserCount] = useState(0);
  // Load cached stats immediately for a 'snappy' feel
  const [dailyStats, setDailyStats] = useState(() => {
    const cached = localStorage.getItem('hspot_daily_stats');
    return cached ? JSON.parse(cached) : { revenue: 0, count: 0 };
  });
  const [isLoading, setIsLoading] = useState(false);

  // Sync sales from context to dailyStats local state for the dashboard cards
  useEffect(() => {
    if (sales.length > 0) {
      const stats = calculateMikhmonStats(sales);
      setDailyStats(stats);
      localStorage.setItem('hspot_daily_stats', JSON.stringify(stats));
    }
  }, [sales]);

  useEffect(() => {
    if (!activeRouter) return;

    // FAST POLLING: Monitoring (CPU, RAM, Traffic) - Frequency: 10s
    const fetchMonitoring = async () => {
      try {
        const sample = await getMonitoringSnapshot(activeRouter);
        if (sample) {
          setBandwidthData(prev => [...prev.slice(-20), {
            time: sample.timestamp,
            rx: sample.rxBps / 1024, 
            tx: sample.txBps / 1024,
            cpu: sample.cpuPercent,
            ram: sample.ramPercent
          }]);
          setActiveUserCount(sample.activeUsers || 0);
        }
      } catch (err) {
        console.error('Monitoring failed:', err);
      }
    };

    // Trigger the SHARED SalesContext (used by all pages) for today's revenue.
    // This avoids a double-fetch: the SalesContext already handles caching + polling.
    fetchSales('today');

    fetchMonitoring();
    const monitorInterval = setInterval(fetchMonitoring, 10000);
    // Refresh revenue every 2 minutes (was every 60s — less aggressive now)
    const salesInterval = setInterval(() => fetchSales('today'), 120000);

    return () => {
      clearInterval(monitorInterval);
      clearInterval(salesInterval);
    };
  }, [activeRouter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white">Tableau de Bord</h1>
          <p className="text-white/40 font-body">Bienvenue, voici un aperçu de votre activité aujourd'hui : {activeRouter?.name}</p>
        </div>
        <button className="btn-primary flex items-center gap-2 w-fit">
          <CircleDollarSign size={18} />
          <span>Vendre un Coupon</span>
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Revenu du Jour" 
          value={formatCurrency(dailyStats.revenue, settings)} 
          icon={Wallet} 
          color="primary"
          trend="up"
          trendValue={isSalesLoading ? "Chargement..." : "Aujourd'hui"}
        />
        <StatsCard 
          title="Utilisateurs Actifs" 
          value={activeUserCount.toString()} 
          icon={Users} 
          color="secondary"
          trend="up"
          trendValue="Live"
        />
        <StatsCard 
          title="Tickets Vendus" 
          value={dailyStats.count.toString()} 
          icon={Ticket} 
          color="accent"
        />
        <StatsCard 
          title="État Routeur" 
          value={activeRouter ? "Connecté" : "Déconnecté"} 
          icon={Wifi} 
          color={activeRouter ? "primary" : "red-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bandwidth Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Activity size={20} />
              </div>
              <h3 className="text-lg font-heading font-bold">Bande Passante Réelle</h3>
            </div>
          </div>
          
          <div style={{ height: 300, width: '100%', minHeight: 300 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={bandwidthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5A0" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00E5A0" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066FF" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0066FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  hide={bandwidthData.length < 5} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#ffffff20', fontSize: 10 }}
                />
                <YAxis 
                  stroke="#ffffff10" 
                  fontSize={10} 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(value) => `${value}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(7, 9, 13, 0.95)', 
                    border: '1px solid rgba(0, 229, 160, 0.2)', 
                    borderRadius: '16px',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 0 30px rgba(0, 229, 160, 0.1)'
                  }}
                  itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="rx" 
                  name="Réception"
                  stroke="#00E5A0" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorRx)" 
                  animationDuration={2000}
                />
                <Area 
                  type="monotone" 
                  dataKey="tx" 
                  name="Émission"
                  stroke="#0066FF" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorTx)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time Status */}
        <div className="neon-card p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-heading font-black tracking-widest text-white/80">Système</h3>
            {activeRouter && <div className="pulse-green" title="Connexion Live" />}
          </div>

          <div className="space-y-8 relative">
            <div className="scanner-line" />
            
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-white/30 uppercase font-black tracking-tighter">Charge CPU</span>
                <span className="text-sm font-black text-primary font-mono">{bandwidthData[bandwidthData.length-1]?.cpu || 0}%</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-primary shadow-[0_0_15px_rgba(0,229,160,0.5)] transition-all duration-1000" 
                  style={{ width: `${bandwidthData[bandwidthData.length-1]?.cpu || 0}%` }} 
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-white/30 uppercase font-black tracking-tighter">Mémoire Vive</span>
                <span className="text-sm font-black text-secondary font-mono">{bandwidthData[bandwidthData.length-1]?.ram || 0}%</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-secondary shadow-[0_0_15px_rgba(0,102,255,0.5)] transition-all duration-1000" 
                  style={{ width: `${bandwidthData[bandwidthData.length-1]?.ram || 0}%` }} 
                />
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-white/5">
              <div className="flex items-center justify-between text-[9px] uppercase font-bold text-white/20">
                <span>Dernière télémétrie</span>
                <span className="text-primary/60 font-mono">{bandwidthData[bandwidthData.length-1]?.time || 'En attente...'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
