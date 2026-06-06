import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';

const RouterContext = createContext();

export function RouterProvider({ children }) {
  const { user, token } = useAuth();
  const [routers, setRouters] = useState([]);
  const [activeRouterId, setActiveRouterId] = useState(
    localStorage.getItem('hspot_active_router_id') || null
  );

  // Real-time listener on Firestore routers collection
  useEffect(() => {
    if (!user) {
      setRouters([]);
      setActiveRouterId(null);
      return;
    }

    const q = query(
      collection(db, 'routers'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routerList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRouters(routerList);

      // Auto-select first router if none selected
      if (routerList.length > 0 && !activeRouterId) {
        setActiveRouterId(routerList[0].id);
      } else if (routerList.length > 0 && !routerList.find(r => r.id === activeRouterId)) {
        setActiveRouterId(routerList[0].id);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (activeRouterId) {
      localStorage.setItem('hspot_active_router_id', activeRouterId);
    }
  }, [activeRouterId]);

  const activeRouter = routers.find(r => r.id === activeRouterId) || routers[0];

  const addRouter = async (routerData) => {
    try {
      const docRef = await addDoc(collection(db, 'routers'), {
        ...routerData,
        ownerId: user.uid,
        status: 'online',
        createdAt: serverTimestamp()
      });
      setActiveRouterId(docRef.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const removeRouter = async (id) => {
    try {
      await deleteDoc(doc(db, 'routers', id));
      if (activeRouterId === id) {
        const remaining = routers.filter(r => r.id !== id);
        setActiveRouterId(remaining[0]?.id || null);
      }
    } catch (err) {
      console.error('Failed to delete router', err);
    }
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
