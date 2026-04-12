import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

function StatsCard({ title, value, icon: Icon, color, trend, trendValue }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-white/10 transition-all duration-300">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 bg-${color} blur-2xl group-hover:opacity-20 transition-all`} />
      
      <div className="flex items-center justify-between">
        <div className={`w-12 h-12 rounded-xl bg-${color}/10 flex items-center justify-center border border-${color}/20 text-${color}`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trend === 'up' ? 'text-primary' : 'text-red-500'}`}>
            {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-white/40 text-xs uppercase tracking-widest font-heading mb-1">{title}</p>
        <h3 className="text-3xl font-heading font-extrabold tracking-tight">{value}</h3>
      </div>
    </div>
  );
}

export default StatsCard;
