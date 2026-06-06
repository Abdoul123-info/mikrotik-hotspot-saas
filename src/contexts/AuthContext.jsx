import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { onIdTokenChanged, signOut } from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        localStorage.setItem('hspot_token', idToken);
        setUser(firebaseUser);
        setToken(idToken);
      } else {
        localStorage.removeItem('hspot_token');
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setToken(null);
    localStorage.removeItem('hspot_token');
    localStorage.removeItem('hspot_active_router_id');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ token, user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
