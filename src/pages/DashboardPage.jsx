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
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bandwidthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5A0" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#00E5A0" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066FF" stopOpacity={0.6}/>
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
                    backgroundColor: 'rgba(21, 25, 33, 0.95)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                    borderRadius: '16px',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="rx" 
                  name="Entrée (RX)"
                  stroke="#00E5A0" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorRx)" 
                  animationDuration={1500}
                />
                <Area 
                  type="monotone" 
                  dataKey="tx" 
                  name="Sortie (TX)"
                  stroke="#0066FF" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorTx)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time Status */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-heading font-bold">État du Routeur</h3>
          </div>

          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-white/40 uppercase">Charge CPU</span>
                <span className="text-xs font-bold text-primary">{bandwidthData[bandwidthData.length-1]?.cpu || 0}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-1000" 
                  style={{ width: `${bandwidthData[bandwidthData.length-1]?.cpu || 0}%` }} 
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-white/40 uppercase">Utilisation RAM</span>
                <span className="text-xs font-bold text-secondary">{bandwidthData[bandwidthData.length-1]?.ram || 0}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-secondary transition-all duration-1000" 
                  style={{ width: `${bandwidthData[bandwidthData.length-1]?.ram || 0}%` }} 
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1">Dernière mise à jour</p>
              <p className="text-xs">{bandwidthData[bandwidthData.length-1]?.time || '---'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
