import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Wallet, 
  Ticket, 
  Wifi, 
  Activity, 
  Smartphone,
  Copy,
  CheckCircle2,
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

// ── Mini QR Code generator (no external lib) ─────────────────────────
// Uses the `qrcode` package already present in package.json via dynamic import
function MobileQRPanel() {
  const [qrSvg, setQrSvg] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = window.location.origin;
    setAppUrl(url);
    // Dynamically import qrcode (already in deps) to generate SVG
    import('qrcode').then(QRCode => {
      QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#00E5A0', light: '#00000000' } })
        .then(svg => setQrSvg(svg))
        .catch(() => setQrSvg(''));
    }).catch(() => setQrSvg(''));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="neon-card p-4 md:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2.5 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Smartphone size={16} className="text-primary md:w-5 md:h-5" />
          </div>
          <div>
            <h3 className="text-xs md:text-sm font-heading font-black tracking-widest text-white/80 uppercase">Accès Mobile</h3>
            <p className="text-[9px] md:text-[10px] text-white/30 mt-0.5">Scanner avec un téléphone</p>
          </div>
        </div>
        <div className="pulse-green" title="URL Live" />
      </div>

      {/* QR Code */}
      <div className="flex-1 flex items-center justify-center py-2 md:py-0">
        <div className="relative group">
          <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-xl md:rounded-2xl bg-black/40 border border-primary/20 p-2 md:p-3 flex items-center justify-center overflow-hidden shadow-[0_0_30px_rgba(0,229,160,0.12)]">
            {qrSvg ? (
              <div
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                className="w-full h-full [&_svg]:w-full [&_svg]:h-full"
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-white/5 animate-pulse" />
            )}
          </div>
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-3 h-3 md:w-4 md:h-4 border-t-2 border-l-2 border-primary rounded-tl-md" />
          <div className="absolute top-0 right-0 w-3 h-3 md:w-4 md:h-4 border-t-2 border-r-2 border-primary rounded-tr-md" />
          <div className="absolute bottom-0 left-0 w-3 h-3 md:w-4 md:h-4 border-b-2 border-l-2 border-primary rounded-bl-md" />
          <div className="absolute bottom-0 right-0 w-3 h-3 md:w-4 md:h-4 border-b-2 border-r-2 border-primary rounded-br-md" />
        </div>
      </div>

      {/* URL + copy */}
      <div className="mt-4 md:mt-6 space-y-2 md:space-y-3">
        <div className="flex items-center gap-2 p-2.5 md:p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[9px] md:text-[10px] font-mono text-white/50 flex-1 truncate">{appUrl || '...'}</p>
          <button
            onClick={handleCopy}
            className="shrink-0 p-1 md:p-1.5 rounded-lg hover:bg-white/10 transition-all"
            title="Copier l'URL"
          >
            {copied
              ? <CheckCircle2 size={13} className="text-primary md:w-3.5 md:h-3.5" />
              : <Copy size={13} className="text-white/40 md:w-3.5 md:h-3.5" />}
          </button>
        </div>
        <p className="text-[9px] md:text-[10px] text-white/20 text-center leading-relaxed">
          Scanne ce QR Code pour ouvrir l'app sur ton téléphone depuis le même réseau.
        </p>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const { settings } = useSettings();
  const { activeRouter } = useRouter();
  const { sales, fetchSales, isLoading: isSalesLoading } = useSales();
  
  const [bandwidthData, setBandwidthData] = useState([]);
  const [activeUserCount, setActiveUserCount] = useState(0);
  const [dailyStats, setDailyStats] = useState({ revenue: 0, count: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // 🔄 RESET dashboard-specific data when router changes
  useEffect(() => {
    if (!activeRouter) return;
    // Reset monitoring data for new router
    setBandwidthData([]);
    setActiveUserCount(0);
    // Load cached stats for THIS router (keyed by router ID)
    const cacheKey = `hspot_daily_stats_${activeRouter.id}`;
    const cached = localStorage.getItem(cacheKey);
    setDailyStats(cached ? JSON.parse(cached) : { revenue: 0, count: 0 });
  }, [activeRouter?.id]);

  // Sync sales from context to dailyStats local state for the dashboard cards
  useEffect(() => {
    if (sales.length > 0 && activeRouter) {
      const stats = calculateMikhmonStats(sales);
      setDailyStats(stats);
      localStorage.setItem(`hspot_daily_stats_${activeRouter.id}`, JSON.stringify(stats));
    } else if (sales.length === 0) {
      setDailyStats({ revenue: 0, count: 0 });
    }
  }, [sales, activeRouter?.id]);

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
    fetchSales('today');

    fetchMonitoring();
    const monitorInterval = setInterval(fetchMonitoring, 10000);
    // Refresh revenue every 2 minutes
    const salesInterval = setInterval(() => fetchSales('today'), 120000);

    return () => {
      clearInterval(monitorInterval);
      clearInterval(salesInterval);
    };
  }, [activeRouter]);

  return (
    <div className="space-y-5 md:space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-heading font-extrabold text-white">Tableau de Bord</h1>
          <p className="text-xs md:text-sm text-white/40 font-body mt-0.5">Bienvenue, voici un aperçu de votre activité aujourd'hui : {activeRouter?.name}</p>
        </div>
        <button className="btn-primary flex items-center gap-2 w-fit text-[11px] md:text-xs px-4 py-2.5 md:px-6 md:py-3">
          <CircleDollarSign size={16} />
          <span>Vendre un Coupon</span>
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 gap-5 md:gap-8">
        {/* Bandwidth Chart - spans 2 cols */}
        <div className="lg:col-span-2 glass-card p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Activity size={17} className="md:hidden" />
                <Activity size={20} className="hidden md:block" />
              </div>
              <h3 className="text-sm md:text-lg font-heading font-bold">Bande Passante</h3>
            </div>
          </div>
          
          <div className="h-[200px] md:h-[300px] w-full">
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

        {/* Real-time Status + Mobile QR — stacked in the right column */}
        <div className="flex flex-col gap-4 md:gap-6">

          {/* System status card */}
          <div className="neon-card p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-xs md:text-sm font-heading font-black tracking-widest text-white/80 uppercase">Système</h3>
              {activeRouter && <div className="pulse-green" title="Connexion Live" />}
            </div>

            <div className="space-y-6 relative">
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

              <div className="pt-3 border-t border-white/5">
                <div className="flex items-center justify-between text-[9px] uppercase font-bold text-white/20">
                  <span>Dernière télémétrie</span>
                  <span className="text-primary/60 font-mono">{bandwidthData[bandwidthData.length-1]?.time || 'En attente...'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile QR Code panel */}
          <MobileQRPanel />

        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
