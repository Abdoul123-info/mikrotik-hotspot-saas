import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

function StatsCard({ title, value, icon: Icon, color, trend, trendValue }) {
  const isPrimary = color === 'primary';
  
  return (
    <div className={`neon-card p-3.5 sm:p-5 md:p-6 flex flex-col justify-between gap-3 md:gap-4 group transition-all duration-300 hover:-translate-y-1 ${isPrimary ? 'border-primary/30' : ''}`}>
      {/* Decorative Glows */}
      <div className={`absolute -right-10 -top-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full opacity-10 bg-${color} blur-3xl group-hover:opacity-30 transition-all duration-700`} />
      <div className="scanner-line opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-${color}/10 flex items-center justify-center border border-${color}/20 text-${color} shadow-md shadow-${color}/5 shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg bg-white/5 border border-white/5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${trend === 'up' ? 'text-primary' : 'text-red-500'}`}>
            {trend === 'up' ? <TrendingUp size={10} className="sm:w-3 sm:h-3" /> : <TrendingDown size={10} className="sm:w-3 sm:h-3" />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      <div className="relative z-10 min-w-0">
        <p className="text-white/40 text-[9px] sm:text-[10px] md:text-[11px] uppercase font-bold tracking-wider font-heading mb-0.5 sm:mb-1 truncate">{title}</p>
        <h3 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-heading font-black tracking-tight text-white group-hover:text-primary transition-colors duration-300 truncate">
          {value}
        </h3>
      </div>
    </div>
  );
}

export default StatsCard;
