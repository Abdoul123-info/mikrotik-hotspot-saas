import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMikhmonSales } from '../api/mikrotik.real';
import { parseTicketDate } from '../utils/sales';
import { useRouter } from './RouterContext';

const SalesContext = createContext();

const CACHE_KEY = 'hspot_mikhmon_sales_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function SalesProvider({ children }) {
  const { activeRouter } = useRouter();

  // Initialiser avec le cache localStorage pour un affichage instantané
  const [sales, setSales] = useState([]);
  const [dataMode, setDataMode] = useState('none'); // 'none' | 'today' | 'full'
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);
  
  // Ref pour suivre l'état interne sans provoquer de re-renders de fetchSales
  const modeRef = React.useRef('none');

  // Initialisation synchronisée avec le cache
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, routerIp, ts } = JSON.parse(cached);
        const saved = JSON.parse(localStorage.getItem('hspot_routers') || '[]');
        const activeId = localStorage.getItem('hspot_active_router_id');
        const active = saved.find(r => r.id === activeId) || saved[0];
        
        if (active?.ip === routerIp && Date.now() - ts < CACHE_TTL) {
          setSales(data);
          setDataMode('full');
          modeRef.current = 'full';
          setLastSync(new Date(ts));
        }
      }
    } catch (e) {
      console.warn('Cache load failed:', e);
    }
  }, []);

  // Ref pour le verrou de chargement (plus robuste que le state simple pour les appels simultanés)
  const fetchingRef = React.useRef(false);

  const fetchSales = useCallback(async (mode = 'full', force = false) => {
    if (!activeRouter) return;
    
    // OPTIMISATION: Sauter si on a déjà les données (sauf si force=true)
    if (!force && modeRef.current === 'full') return;
    if (!force && modeRef.current === 'today' && mode === 'today') return;
    
    // VERROU: Empêcher les appels simultanés (Dashboard + Sales + Analytics)
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date();
      // Format des scripts sur ce routeur : YYYY-MM-DD-|-...
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      // Toujours récupérer via le stream complet (super rapide) sans filtre routeur
      // car appliquer un filtre sur 15 000 scripts fait crasher le CPU du MikroTik
      let query = {};
      
      // Pass mode to API for server-side filtering (tablet/mobile optimization)
      const rawScripts = await getMikhmonSales(activeRouter, query, mode);
      
      // FILTRAGE CLIENT (JS) - Ultra-fast once data is in bandwidth
      let finalScripts = rawScripts;
      if (mode === 'month') {
          // Keep only current month/year for the state
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();
          
          finalScripts = rawScripts.filter(s => {
              const d = parseTicketDate({ comment: s.date });
              return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          });
      }

      if (finalScripts && finalScripts.length > 0) {
        setSales(finalScripts);
        setLastSync(new Date());
        setDataMode(mode);
        modeRef.current = mode;

        if (mode === 'full') {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: finalScripts,
            routerIp: activeRouter.ip,
            ts: Date.now()
          }));
        }
      } else if (!force && sales.length > 0) {
          // On garde les anciennes données si le fetch échoue ou est vide (sauf si force)
          console.warn('Fetch vente vide ou échoué, conservation des données existantes');
      } else {
          setSales([]);
      }
    } catch (err) {
      console.error('Fetch sales error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [activeRouter, sales.length]); // Dépendances stabilisées


  return (
    <SalesContext.Provider value={{ 
      sales, 
      isLoading, 
      lastSync, 
      error, 
      dataMode,
      fetchSales 
    }}>
      {children}
    </SalesContext.Provider>
  );
}

export const useSales = () => useContext(SalesContext);
