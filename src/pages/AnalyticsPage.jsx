import React, { useState, useMemo, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, BarChart3,
  RefreshCw, Award, Zap, Calendar
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useSales } from '../contexts/SalesContext';
import { formatCurrency } from '../utils/currency';
import { parseTicketDate, isSameDay } from '../utils/sales';

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const COLORS = ['#00e5ff','#7c3aed','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16'];

// Custom Tooltip
const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-dark/95 border border-white/10 rounded-xl p-3 shadow-xl">
      <p className="text-white/60 text-xs mb-2">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name === 'Revenus' ? formatCurrency(entry.value, currency) : `${entry.value} ventes`}
        </p>
      ))}
    </div>
  );
};

function StatCard({ icon, label, value, sub, trend, color = 'primary' }) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    green: 'text-green-400 bg-green-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  };
  return (
    <div className="glass-card p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/40 text-xs uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-heading font-extrabold text-white mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}% vs mois dernier
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const { settings } = useSettings();
  const { sales, isLoading, error, fetchSales, lastSync } = useSales();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchSales('full');
  }, [fetchSales]);

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  // ── Consolidated Analytics Data Processing ──────────────────────────────────
  const analytics = useMemo(() => {
    // 1. Initialize stats
    const today = new Date(); today.setHours(0,0,0,0);
    let todayRev = 0, monthRev = 0, lastMonthRev = 0, totalRev = 0, totalCount = 0, monthCount = 0;
    const profileMap = {};
    
    // 2. Initialize Last 12 Months
    const last12Months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      last12Months.push({ month: d.getMonth(), year: d.getFullYear(), label: MONTHS_FR[d.getMonth()], Revenus: 0, Ventes: 0 });
    }

    // 3. Initialize Weekdays
    const weekdayData = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'].map(d=>({label:d,Revenus:0,Ventes:0}));

    // 4. Initialize Daily Data
    const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i+1), Revenus: 0, Ventes: 0 }));

    // ── Single Pass Processing ──
    for (const s of sales) {
      const price = s.price || 0;
      if (!price) continue;
      
      const d = parseTicketDate({ comment: s.dateRaw || s.date });
      if (!d) continue;

      const dMonth = d.getMonth();
      const dYear = d.getFullYear();

      // Scalar Stats
      totalRev += price;
      totalCount++;
      if (isSameDay(d, today)) todayRev += price;
      if (dMonth === thisMonth && dYear === thisYear) {
        monthRev += price; monthCount++;
        
        // Profiles (Only current month)
        const prof = s.profile || 'Autres';
        if (!profileMap[prof]) profileMap[prof] = { name: prof, value: 0, count: 0 };
        profileMap[prof].value += price;
        profileMap[prof].count++;

        // Daily (Only current month)
        dailyData[d.getDate()-1].Revenus += price;
        dailyData[d.getDate()-1].Ventes++;
      }
      if (dMonth === lastMonth && dYear === lastMonthYear) lastMonthRev += price;

      // Last 12 Months
      const foundIdx = last12Months.findIndex(m => m.month === dMonth && m.year === dYear);
      if (foundIdx !== -1) { 
        last12Months[foundIdx].Revenus += price; 
        last12Months[foundIdx].Ventes++; 
      }

      // Weekdays
      weekdayData[d.getDay()].Revenus += price;
      weekdayData[d.getDay()].Ventes++;
    }

    const topProfile = Object.entries(profileMap).sort((a,b) => b[1].value-a[1].value)[0]?.[0] || '---';
    const monthTrend = lastMonthRev > 0 ? Math.round(((monthRev - lastMonthRev) / lastMonthRev) * 100) : 0;
    const profileData = Object.values(profileMap).sort((a,b) => b.value - a.value).slice(0, 8);

    return { 
      stats: { todayRev, monthRev, lastMonthRev, totalRev, totalCount, monthCount, topProfile, monthTrend },
      last12Months,
      profileData,
      dailyData,
      weekdayData
    };
  }, [sales, thisMonth, thisYear, lastMonth, lastMonthYear]);

  // Extract consolidated data
  const { stats, last12Months, profileData, dailyData, weekdayData } = analytics;
  const { todayRev, monthRev, lastMonthRev, totalRev, totalCount, monthCount, topProfile, monthTrend } = stats;
  const bestDay = weekdayData.reduce((a,b) => b.Revenus > a.Revenus ? b : a, weekdayData[0]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-400 font-bold">Erreur de connexion au routeur</p>
        <p className="text-white/30 text-sm">{error}</p>
        <button onClick={() => fetchSales('full')} className="px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white flex items-center gap-3">
            <BarChart3 className="text-primary" />
            Analytics
          </h1>
          <p className="text-white/40 font-body mt-1">
            Insights business avancés
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchSales('full')} 
            disabled={isLoading}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<Zap size={22}/>} label="Auj." value={formatCurrency(todayRev, settings)} color="primary" />
        <StatCard icon={<Calendar size={22}/>} label="Ce mois" value={formatCurrency(monthRev, settings)} sub={`${monthCount} ventes`} trend={monthTrend} color="green" />
        <StatCard icon={<Award size={22}/>} label="Top profil" value={topProfile} sub="Ce mois" color="amber" />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 bg-white/5 p-1 rounded-xl w-fit border border-white/5">
        {[
          { id: 'overview', label: '📈 Vue globale' },
          { id: 'profiles', label: '🥧 Par profil' },
          { id: 'trends', label: '📅 Tendances' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.id ? 'bg-primary text-bg-dark shadow-lg' : 'text-white/50 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === TAB: Overview === */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Area Chart — 12 derniers mois */}
          <div className="glass-card p-6">
            <h3 className="font-heading font-bold text-white mb-1">Revenus — 12 derniers mois</h3>
            <p className="text-xs text-white/30 mb-6">Tendance de vos revenus sur l'année écoulée</p>
            <div style={{ height: 260, minHeight: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last12Months}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip currency={settings} />} />
                  <Area type="monotone" dataKey="Revenus" stroke="#00e5ff" strokeWidth={2} fill="url(#areaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar chart — jours ce mois */}
          <div className="glass-card p-6">
            <h3 className="font-heading font-bold text-white mb-1">Ventes par jour — {MONTHS_FR[thisMonth]}</h3>
            <p className="text-xs text-white/30 mb-6">Chaque barre représente les revenus d'une journée</p>
            <div style={{ height: 220, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip currency={settings} />} />
                  <Bar dataKey="Revenus" radius={[4,4,0,0]}>
                    {dailyData.map((entry, index) => (
                      <Cell key={index} fill={entry.label === String(now.getDate()) ? '#00e5ff' : 'rgba(0,229,255,0.25)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* === TAB: Profiles === */}
      {activeTab === 'profiles' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="glass-card p-6">
              <h3 className="font-heading font-bold text-white mb-1">Répartition par profil</h3>
              <p className="text-xs text-white/30 mb-4">Part de chaque forfait dans les revenus du mois</p>
              {profileData.length > 0 ? (
                <div style={{ height: 260, minHeight: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={profileData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                        {profileData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v, settings)} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-white/20 italic text-sm">
                  Aucune vente ce mois
                </div>
              )}
            </div>

            {/* Ranking profils */}
            <div className="glass-card p-6">
              <h3 className="font-heading font-bold text-white mb-4">Classement des profils</h3>
              <div className="space-y-3">
                {profileData.length > 0 ? profileData.map((p, i) => {
                  const maxVal = profileData[0].value;
                  const pct = maxVal > 0 ? Math.round((p.value / maxVal) * 100) : 0;
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white/30 w-4">#{i+1}</span>
                          <span className="text-sm font-bold text-white">{p.name}</span>
                          <span className="text-xs text-white/30">{p.count} ventes</span>
                        </div>
                        <span className="text-sm font-bold" style={{color: COLORS[i % COLORS.length]}}>
                          {formatCurrency(p.value, settings)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-white/20 italic text-sm">Aucune donnée disponible</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === TAB: Trends === */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Meilleur jour de la semaine */}
          <div className="glass-card p-6">
            <h3 className="font-heading font-bold text-white mb-1">Performance par jour de la semaine</h3>
            <p className="text-xs text-white/30 mb-2">
              Meilleur jour : <span className="text-primary font-bold">{bestDay?.label}</span> — {formatCurrency(bestDay?.Revenus || 0, settings)} en moyenne
            </p>
            <div style={{ height: 220, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip currency={settings} />} />
                  <Bar dataKey="Revenus" radius={[6,6,0,0]}>
                    {weekdayData.map((entry, index) => (
                      <Cell key={index} fill={entry.label === bestDay?.label ? '#00e5ff' : 'rgba(124,58,237,0.4)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparaison mois */}
          <div className="glass-card p-6">
            <h3 className="font-heading font-bold text-white mb-4">Comparaison mois courant vs mois dernier</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Mois dernier</p>
                <p className="text-3xl font-heading font-black text-white/60">{formatCurrency(lastMonthRev, settings)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Ce mois</p>
                <p className={`text-3xl font-heading font-black ${monthTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(monthRev, settings)}
                </p>
              </div>
              <div className="col-span-2 flex items-center justify-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                {monthTrend >= 0 ? <TrendingUp className="text-green-400" /> : <TrendingDown className="text-red-400"/>}
                <span className={`text-xl font-black ${monthTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {monthTrend >= 0 ? '+' : ''}{monthTrend}%
                </span>
                <span className="text-white/40 text-sm">par rapport au mois dernier</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsPage;
