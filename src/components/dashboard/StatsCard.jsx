import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

function StatsCard({ title, value, icon: Icon, color, trend, trendValue }) {
  const isPrimary = color === 'primary';
  
  return (
    <div className={`neon-card p-6 flex flex-col gap-4 group transition-all duration-500 hover:-translate-y-1 ${isPrimary ? 'border-primary/30' : ''}`}>
      {/* Decorative Glows */}
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-10 bg-${color} blur-3xl group-hover:opacity-30 transition-all duration-700`} />
      <div className="scanner-line opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className={`w-12 h-12 rounded-xl bg-${color}/10 flex items-center justify-center border border-${color}/20 text-${color} shadow-lg shadow-${color}/5`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-wider ${trend === 'up' ? 'text-primary' : 'text-red-500'}`}>
            {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      <div className="relative z-10">
        <p className="text-white/30 text-[10px] uppercase font-bold tracking-[0.2em] font-heading mb-1">{title}</p>
        <h3 className="text-3xl font-heading font-black tracking-tight text-white group-hover:text-primary transition-colors duration-500">
          {value}
        </h3>
      </div>
    </div>
  );
}

export default StatsCard;
