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
  // Track which router the current data belongs to
  const routerIdRef = React.useRef(null);

  // 🔄 RESET when activeRouter changes — critical to avoid showing stale data from previous router
  useEffect(() => {
    const newRouterId = activeRouter?.id || null;
    if (newRouterId !== routerIdRef.current) {
      // Router changed: reset everything
      setSales([]);
      setDataMode('none');
      modeRef.current = 'none';
      routerIdRef.current = newRouterId;
      setLastSync(null);
      setError(null);
      
      // Try to load from localStorage cache for THIS specific router
      if (newRouterId) {
        try {
          const cached = localStorage.getItem(`hspot_mikhmon_sales_${newRouterId}`);
          if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < CACHE_TTL) {
              setSales(data);
              setDataMode('full');
              modeRef.current = 'full';
              setLastSync(new Date(ts));
            }
          }
        } catch (e) {
          console.warn('Cache load failed:', e);
        }
      }
    }
  }, [activeRouter]);

  // Ref pour le verrou de chargement (plus robuste que le state simple pour les appels simultanés)
  const fetchingRef = React.useRef(false);

  const fetchSales = useCallback(async (mode = 'full', force = false) => {
    if (!activeRouter) return;
    
    // OPTIMISATION: Sauter si on a déjà les données pour CE routeur (sauf si force=true)
    if (!force && routerIdRef.current === activeRouter.id && modeRef.current === 'full') return;
    if (!force && routerIdRef.current === activeRouter.id && modeRef.current === 'today' && mode === 'today') return;
    
    // VERROU: Empêcher les appels simultanés (Dashboard + Sales + Analytics)
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date();

      // Toujours récupérer via le stream complet (super rapide) sans filtre routeur
      let query = {};
      
      // Pass mode to API for server-side filtering (tablet/mobile optimization)
      const rawScripts = await getMikhmonSales(activeRouter, query, mode);
      
      // FILTRAGE CLIENT (JS) - Ultra-fast once data is in bandwidth
      let finalScripts = rawScripts;
      if (mode === 'month') {
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
        routerIdRef.current = activeRouter.id;

        if (mode === 'full') {
          localStorage.setItem(`hspot_mikhmon_sales_${activeRouter.id}`, JSON.stringify({
            data: finalScripts,
            routerId: activeRouter.id,
            routerIp: activeRouter.ip,
            ts: Date.now()
          }));
        }
      } else if (!force && sales.length > 0 && routerIdRef.current === activeRouter.id) {
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
