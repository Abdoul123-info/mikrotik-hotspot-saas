import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Calendar,
  RefreshCw,
  TrendingUp,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useRouter } from '../contexts/RouterContext';
import { useSales } from '../contexts/SalesContext';
import { formatCurrency } from '../utils/currency';

import { parseTicketDate, isSameDay } from '../utils/sales';

// ── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Format a date as "dd/mm/yyyy à HH:MM" or "dd/mm/yyyy" if no time info
const formatDateDisplay = (d) => {
  if (!d) return '—';
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
  const datePart = d.toLocaleDateString('fr-FR');
  if (hasTime) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${datePart} à ${h}:${m}`;
  }
  return datePart;
};

// Returns start (00:00:00) and end (23:59:59) of a period in local time
const getPeriodBounds = (viewMode, year, month, day) => {
  if (viewMode === 'day') {
    return {
      start: new Date(year, month, day, 0, 0, 0, 0),
      end:   new Date(year, month, day, 23, 59, 59, 999)
    };
  }
  if (viewMode === 'month') {
    return {
      start: new Date(year, month, 1, 0, 0, 0, 0),
      end:   new Date(year, month + 1, 0, 23, 59, 59, 999) // day 0 of next month = last day of this month
    };
  }
  // year
  return {
    start: new Date(year, 0,  1,  0, 0, 0, 0),
    end:   new Date(year, 11, 31, 23, 59, 59, 999)
  };
};

// ── Component ─────────────────────────────────────────────────────────────────
function SalesPage() {
  const { settings } = useSettings();
  const { activeRouter } = useRouter();
  const { sales, isLoading, error, fetchSales, lastSync } = useSales();

  useEffect(() => {
    fetchSales('full');
  }, [fetchSales]);

  const now = new Date();
  const [viewMode, setViewMode] = useState('month'); // 'day' | 'month' | 'year'
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [showAllRows, setShowAllRows] = useState(false);
  const MAX_DISPLAY = 100;

  const allTickets = useMemo(() => {
    return sales.map(s => ({
      id: s.id,
      username: s.user, // Corrected: use .user from the context
      price: s.price,
      profileName: s.profile,
      comment: s.date,
      status: 'used'
    }));
  }, [sales]);

  const fetchData = () => fetchSales('month');

  // ── Filter tickets by selected period ─────────────────────────────────────
  // Only keep real voucher tickets: paid profile (price > 0) AND consumed AND not in the future
  const salesTickets = useMemo(() => {
    const now = new Date(); // current moment — tickets after NOW are excluded
    return allTickets.filter(t => {
      // 1. Exclude system accounts
      if (t.username === 'admin' || t.username === 'default') return false;
      // 2. Must have a price
      if (parseInt(t.price) <= 0) return false;
      // 3. Status checks
      if (t.status !== 'used' && t.status !== 'online') return false;
      // 4. Date validation (must be a valid ticket format)
      const d = parseTicketDate(t);
      // RELAXED FILTER: Allow tickets up to 24 hours in the future to account for router clock mismatch
      if (!d || d > new Date(Date.now() + 24 * 60 * 60 * 1000)) return false;
      return true;
    });
  }, [allTickets]);

  const filteredTickets = useMemo(() => {
    const { start, end } = getPeriodBounds(viewMode, selectedYear, selectedMonth, selectedDay);
    return salesTickets.filter(t => {
      const d = parseTicketDate(t);
      // Tickets without a date (no dd/mm/yyyy in comment) are excluded → they can't be attributed to a specific day
      if (!d) return false;
      // Exact boundary: from 00:00:00 to 23:59:59 local time
      return d >= start && d <= end;
    });
  }, [salesTickets, viewMode, selectedYear, selectedMonth, selectedDay]);

  const totalRevenue = filteredTickets.reduce((acc, t) => acc + (parseInt(t.price) || 0), 0);
  const usedCount = filteredTickets.filter(t => t.status === 'used' || t.status === 'online').length;

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (viewMode === 'year') {
      // Group by month
      const byMonth = Array.from({ length: 12 }, (_, i) => ({
        label: MONTHS_FR[i].substring(0, 3),
        total: 0,
        count: 0
      }));
      filteredTickets.forEach(t => {
        const d = parseTicketDate(t);
        if (d) {
          byMonth[d.getMonth()].total += parseInt(t.price) || 0;
          byMonth[d.getMonth()].count += 1;
        }
      });
      return byMonth;
    }

    if (viewMode === 'month') {
      // Group by day in the month
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const byDay = Array.from({ length: daysInMonth }, (_, i) => ({
        label: String(i + 1).padStart(2, '0'),
        total: 0,
        count: 0
      }));
      filteredTickets.forEach(t => {
        const d = parseTicketDate(t);
        if (d) {
          const idx = d.getDate() - 1;
          byDay[idx].total += parseInt(t.price) || 0;
          byDay[idx].count += 1;
        }
      });
      return byDay;
    }

    if (viewMode === 'day') {
      // Group by profile
      const byProfile = {};
      filteredTickets.forEach(t => {
        const p = t.profileName || t.profileId || 'Inconnu';
        if (!byProfile[p]) byProfile[p] = { label: p, total: 0, count: 0 };
        byProfile[p].total += parseInt(t.price) || 0;
        byProfile[p].count += 1;
      });
      return Object.values(byProfile);
    }

    return [];
  }, [filteredTickets, viewMode, selectedYear, selectedMonth]);

  // Pre-sorted table data with cumulative totals (memoized)
  const sortedTableData = useMemo(() => {
    const sorted = filteredTickets
      .slice()
      .map(t => ({ ...t, _parsed: parseTicketDate(t) }))
      .sort((a, b) => (a._parsed || 0) - (b._parsed || 0));
    let cumul = 0;
    return sorted.map(t => {
      cumul += parseInt(t.price) || 0;
      return { ...t, cumul };
    });
  }, [filteredTickets]);

  // ── Nav helpers ────────────────────────────────────────────────────────────
  const prevPeriod = () => {
    if (viewMode === 'year') setSelectedYear(y => y - 1);
    if (viewMode === 'month') {
      if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
      else setSelectedMonth(m => m - 1);
    }
    if (viewMode === 'day') {
      const prev = new Date(selectedYear, selectedMonth, selectedDay - 1);
      setSelectedYear(prev.getFullYear());
      setSelectedMonth(prev.getMonth());
      setSelectedDay(prev.getDate());
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'year') setSelectedYear(y => y + 1);
    if (viewMode === 'month') {
      if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
      else setSelectedMonth(m => m + 1);
    }
    if (viewMode === 'day') {
      const next = new Date(selectedYear, selectedMonth, selectedDay + 1);
      setSelectedYear(next.getFullYear());
      setSelectedMonth(next.getMonth());
      setSelectedDay(next.getDate());
    }
  };

  const periodLabel = () => {
    if (viewMode === 'year') return `${selectedYear}`;
    if (viewMode === 'month') return `${MONTHS_FR[selectedMonth]} ${selectedYear}`;
    if (viewMode === 'day') return `${String(selectedDay).padStart(2,'0')} ${MONTHS_FR[selectedMonth]} ${selectedYear}`;
    return '';
  };

  // ── Custom tooltip ─────────────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 border border-primary/20 text-xs">
          <p className="font-black text-white uppercase">{label}</p>
          <p className="text-primary font-bold">{formatCurrency(payload[0].value, settings)}</p>
          <p className="text-white/40">{payload[0].payload.count} ticket(s)</p>
        </div>
      );
    }
    return null;
  };

  // Group tickets by profile for summary
  const byProfile = useMemo(() => {
    const map = {};
    filteredTickets.forEach(t => {
      const p = t.profileName || t.profileId || 'Inconnu';
      if (!map[p]) map[p] = { count: 0, total: 0 };
      map[p].count += 1;
      map[p].total += parseInt(t.price) || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filteredTickets]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white">Ventes</h1>
          <p className="text-white/40 font-body">
            Synchronisé avec MikroTik
            {lastSync && <span className="ml-2 text-primary/40">· {lastSync.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="h-12 px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/60 hover:text-white transition-all text-sm font-bold uppercase">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <button className="h-12 px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/60 hover:text-white transition-all text-sm font-bold uppercase">
            <Download size={16} />
            <span className="hidden sm:inline">Exporter CSV</span>
          </button>
        </div>
      </header>

      {/* ── Period Selector ── */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">

          {/* View mode tabs */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
            {[
              { id: 'day', label: 'Jour' },
              { id: 'month', label: 'Mois' },
              { id: 'year', label: 'Année' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  viewMode === m.id
                    ? 'bg-primary text-black shadow-lg shadow-primary/20'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Period navigation */}
          <div className="flex items-center gap-3 flex-1 justify-center sm:justify-start">
            <button onClick={prevPeriod} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
              <Calendar size={14} className="text-primary" />
              <span className="font-black text-white text-sm">{periodLabel()}</span>
            </div>
            <button onClick={nextPeriod} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day selector for month view */}
          {viewMode === 'day' && (
            <input
              type="date"
              value={`${selectedYear}-${String(selectedMonth + 1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`}
              onChange={e => {
                const d = new Date(e.target.value);
                if (!isNaN(d)) {
                  setSelectedYear(d.getFullYear());
                  setSelectedMonth(d.getMonth());
                  setSelectedDay(d.getDate());
                }
              }}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
            />
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 border-primary/20 bg-primary/5">
          <p className="text-[10px] uppercase font-heading font-bold text-white/40 tracking-widest mb-1">Chiffre d'Affaires</p>
          <h2 className="text-3xl font-heading font-black text-primary">{formatCurrency(totalRevenue, settings)}</h2>
          <p className="text-[10px] text-white/30 mt-1 uppercase">Période : {periodLabel()}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[10px] uppercase font-heading font-bold text-white/40 tracking-widest mb-1">Tickets Vendus</p>
          <h2 className="text-3xl font-heading font-black text-white">{filteredTickets.length}</h2>
          <p className="text-[10px] text-white/30 mt-1 uppercase">{usedCount} consommés</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[10px] uppercase font-heading font-bold text-white/40 tracking-widest mb-1">Prix Moyen</p>
          <h2 className="text-3xl font-heading font-black text-white">
            {filteredTickets.length > 0 ? formatCurrency(Math.round(totalRevenue / filteredTickets.length), settings) : '—'}
          </h2>
          <p className="text-[10px] text-white/30 mt-1 uppercase">{byProfile.length} profil(s)</p>
        </div>
      </div>

      {/* ── Chart + Profile Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Bar Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-heading font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
              <TrendingUp size={14} /> Ventes par {viewMode === 'year' ? 'mois' : viewMode === 'month' ? 'jour' : 'profil'}
            </h3>
          </div>
          {isLoading ? (
            <div className="h-[280px] flex items-center justify-center">
              <RefreshCw className="animate-spin text-primary" size={24} />
            </div>
          ) : chartData.length === 0 || chartData.every(d => d.total === 0) ? (
            <div className="h-[280px] flex items-center justify-center">
              <p className="text-white/20 uppercase text-xs font-bold">Aucune vente sur cette période</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.total > 0 ? 'rgba(0, 230, 118, 0.8)' : 'rgba(255,255,255,0.05)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Profile breakdown */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-heading font-bold uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
            <Ticket size={14} /> Par profil
          </h3>
          {byProfile.length === 0 ? (
            <p className="text-white/20 text-xs uppercase font-bold">Aucun ticket</p>
          ) : (
            <div className="space-y-3">
              {byProfile.map(([name, data]) => {
                const pct = totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-white truncate max-w-[120px]">{name}</span>
                      <div className="text-right">
                        <span className="text-xs font-black text-primary">{formatCurrency(data.total, settings)}</span>
                        <span className="text-[9px] text-white/30 ml-1">({data.count})</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-white/10 flex justify-between">
                <span className="text-[10px] text-white/30 uppercase font-bold">Total général</span>
                <span className="text-sm font-black text-primary">{formatCurrency(totalRevenue, settings)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Table with progressive total ── */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <h3 className="text-sm font-heading font-bold uppercase tracking-widest">
            Détail — {sortedTableData.length} ticket(s)
          </h3>
          <span className="text-[10px] text-white/30 uppercase">Total progressif →</span>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-[#0d1117]">
              <tr className="text-white/40 uppercase text-[10px] tracking-widest font-heading border-b border-white/5">
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Utilisateur</th>
                <th className="px-5 py-3">Profil</th>
                <th className="px-5 py-3">Prix</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-primary">Total cumulé</th>
              </tr>
            </thead>
            <tbody className="text-sm font-body divide-y divide-white/[0.04]">
              {sortedTableData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-20 text-center text-white/20 uppercase text-xs font-bold">
                    {isLoading ? 'Chargement...' : 'Aucune vente sur cette période'}
                  </td>
                </tr>
              ) : (
                (showAllRows ? sortedTableData : sortedTableData.slice(0, MAX_DISPLAY)).map((t, i) => {
                  const d = t._parsed;
                  return (
                    <tr key={t.id || i} className="hover:bg-white/[0.02] transition-all">
                      <td className="px-5 py-3 text-white/20 text-[10px] font-bold">{i + 1}</td>
                      <td className="px-5 py-3 font-mono font-bold text-primary">{t.username}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-bold uppercase text-white/70">{t.profileName || t.profileId || '—'}</span>
                      </td>
                      <td className="px-5 py-3 font-bold">{formatCurrency(parseInt(t.price) || 0, settings)}</td>
                      <td className="px-5 py-3 text-xs">
                        <div className="text-white/60">{d ? d.toLocaleDateString('fr-FR') : '—'}</div>
                        {d && (d.getHours() !== 0 || d.getMinutes() !== 0) && (
                          <div className="text-primary/50 font-mono text-[10px]">
                            {String(d.getHours()).padStart(2,'0')}:{String(d.getMinutes()).padStart(2,'0')}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-black text-primary">{formatCurrency(t.cumul, settings)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedTableData.length > MAX_DISPLAY && !showAllRows && (
          <div className="p-4 border-t border-white/5 text-center">
            <button
              onClick={() => setShowAllRows(true)}
              className="px-6 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all text-sm font-bold"
            >
              Afficher les {sortedTableData.length - MAX_DISPLAY} tickets restants
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SalesPage;
