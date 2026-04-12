import React, { createContext, useContext, useState, useEffect } from 'react';

const RouterContext = createContext();

export function RouterProvider({ children }) {
  const [routers, setRouters] = useState(() => {
    const saved = localStorage.getItem('hspot_routers');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeRouterId, setActiveRouterId] = useState(() => {
    return localStorage.getItem('hspot_active_router_id') || routers[0]?.id;
  });

  useEffect(() => {
    localStorage.setItem('hspot_routers', JSON.stringify(routers));
  }, [routers]);

  useEffect(() => {
    if (activeRouterId) {
      localStorage.setItem('hspot_active_router_id', activeRouterId);
    }
  }, [activeRouterId]);

  const activeRouter = routers.find(r => r.id === activeRouterId) || routers[0];

  const addRouter = (router) => {
    const newRouter = { ...router, id: Date.now().toString(), status: 'online' };
    setRouters(prev => [...prev, newRouter]);
    setActiveRouterId(newRouter.id);
  };

  const removeRouter = (id) => {
    setRouters(prev => prev.filter(r => r.id !== id));
    if (activeRouterId === id) setActiveRouterId(routers[0]?.id);
  };

  return (
    <RouterContext.Provider value={{ 
      routers, 
      activeRouter, 
      setActiveRouterId, 
      addRouter, 
      removeRouter 
    }}>
      {children}
    </RouterContext.Provider>
  );
}

export const useRouter = () => useContext(RouterContext);
