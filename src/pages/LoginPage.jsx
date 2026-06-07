import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Mail, Lock, Loader2, Router, QrCode, Wifi } from 'lucide-react';
import { auth } from '../config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { BASE_URL } from '../config/api';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const [networkInfo, setNetworkInfo] = useState(null);

  useEffect(() => {
    async function fetchNetworkInfo() {
      try {
        const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        const response = await fetch(`${BASE_URL}/api/network-info?port=${currentPort}`);
        if (response.ok) {
          const data = await response.json();
          setNetworkInfo(data);
        }
      } catch (err) {
        console.error("Failed to fetch network info", err);
      }
    }
    fetchNetworkInfo();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err) {
      const errorMessages = {
        'auth/email-already-in-use': 'Cet email est déjà utilisé.',
        'auth/invalid-email': 'Adresse email invalide.',
        'auth/weak-password': 'Mot de passe trop faible (6 caractères min).',
        'auth/user-not-found': 'Aucun compte trouvé avec cet email.',
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/invalid-credential': 'Email ou mot de passe incorrect.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
      };
      setError(errorMessages[err.code] || "Échec de l'authentification.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full min-h-screen bg-bg-dark flex items-center justify-center p-6 relative overflow-hidden">
      {/* Matrix Cyber Grid Background (Matching index.css) */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(0, 229, 160, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 160, 0.05) 1px, transparent 1px)',
             backgroundSize: '40px 40px',
             transform: 'perspective(500px) rotateX(60deg) translateY(-20%) scale(2)'
           }} />

      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[120px]"></div>

      <div className="flex flex-col md:flex-row gap-8 items-center justify-center max-w-4xl w-full relative z-10">
        
        {/* Left Side: Login Card */}
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-tr from-primary to-secondary p-[2px] shadow-2xl shadow-primary/20 mb-6 group transition-all duration-500 hover:scale-105">
              <div className="w-full h-full bg-bg-dark rounded-[calc(1.5rem-2px)] flex items-center justify-center">
                <Router className="w-12 h-12 text-primary group-hover:rotate-12 transition-transform duration-500" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tighter mb-3 font-heading uppercase">
              Hotspot <span className="text-primary">Manager</span>
            </h1>
            <p className="text-white/40 text-sm font-medium tracking-widest uppercase">
              Système de Gestion MikroTik Portable
            </p>
          </div>

          <div className="neon-card p-8 backdrop-blur-3xl">
            <div className="scanner-line"></div>
            
            <div className="flex bg-white/5 p-1 rounded-2xl mb-8 border border-white/5">
              <button 
                onClick={() => setIsLogin(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-500 font-bold uppercase text-[10px] tracking-widest ${isLogin ? 'bg-primary text-bg-dark shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white'}`}
              >
                <LogIn className="w-3.5 h-3.5" />
                Connexion
              </button>
              <button 
                onClick={() => setIsLogin(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-500 font-bold uppercase text-[10px] tracking-widest ${!isLogin ? 'bg-primary text-bg-dark shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white'}`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Inscription
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-[11px] font-bold uppercase tracking-wider animate-pulse">
                  ⚠️ {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Email Réseau</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@hotspot.local"
                    className="w-full bg-white/5 border border-white/10 focus:border-primary outline-none text-white p-4 pl-12 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-primary/5 placeholder:text-white/10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Clé d'Accès</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 focus:border-primary outline-none text-white p-4 pl-12 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-primary/5 placeholder:text-white/10 text-sm"
                  />
                </div>
              </div>

              <button 
                disabled={loading}
                className="w-full bg-primary hover:bg-[#00FFAF] text-bg-dark font-black p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-8 uppercase tracking-widest text-xs"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Authentification' : "Générer Compte"}
                    <LogIn className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-white/20 mt-8 text-[10px] font-bold uppercase tracking-widest">
              Accès sécurisé par <span className="text-primary">Antigravity Proxy</span>
            </p>
          </div>
        </div>

        {/* Right Side: QR Code Network Panel */}
        {networkInfo && networkInfo.qrCode && (
          <div className="max-w-sm w-full neon-card p-8 backdrop-blur-3xl flex flex-col items-center text-center">
            <div className="scanner-line"></div>
            
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary p-[2px] shadow-2xl shadow-primary/20 mb-6">
              <div className="w-full h-full bg-bg-dark rounded-[calc(1rem-2px)] flex items-center justify-center">
                <Wifi className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tighter mb-2 font-heading uppercase">
              Accès <span className="text-primary">Mobile</span>
            </h2>
            <p className="text-white/40 text-xs font-medium tracking-wider uppercase mb-6">
              Scannez pour vous connecter
            </p>

            <div className="relative p-3 bg-white rounded-2xl shadow-2xl shadow-primary/10 transition-transform duration-500 hover:scale-105 mb-6">
              <img 
                src={networkInfo.qrCode} 
                alt="Accès mobile QR Code" 
                className="w-40 h-40 rounded-lg select-none"
              />
            </div>

            <div className="space-y-4 w-full">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1">
                  Adresse IP Locale
                </span>
                <span className="text-sm font-bold text-white font-mono selection:bg-primary selection:text-bg-dark">
                  http://{networkInfo.ip}:{networkInfo.port}
                </span>
              </div>

              <div className="flex items-start gap-2.5 text-left bg-primary/5 border border-primary/20 p-4 rounded-2xl text-[10px] leading-relaxed text-white/70 font-medium uppercase tracking-wider">
                <QrCode className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                <span>
                  Connectez votre téléphone au même réseau Wi-Fi, puis scannez ce code QR pour ouvrir l'application.
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
