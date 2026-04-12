import React, { useState } from 'react';
import { 
  Wifi, 
  Plus, 
  RefreshCw, 
  Zap,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Server
} from 'lucide-react';
import { connectRouter } from '../api/mikrotik.real';
import { useRouter } from '../contexts/RouterContext';
import RouterModal from '../components/routers/RouterModal';

function RoutersPage() {
  const { routers, activeRouter, addRouter, removeRouter, setActiveRouterId } = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});

  const handleTestConnection = async (router) => {
    setTestingId(router.id);
    setTestResults(prev => ({ ...prev, [router.id]: null }));
    const result = await connectRouter(router);
    setTestingId(null);
    setTestResults(prev => ({ ...prev, [router.id]: result }));
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white">Mes Routeurs</h1>
          <p className="text-white/40 font-body">Gérez vos équipements MikroTik et vérifiez leur connexion à l'API REST.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 w-fit"
        >
          <Plus size={18} />
          <span>Nouveau Routeur</span>
        </button>
      </header>

      {routers.length === 0 ? (
        <div className="glass-card p-20 flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Server size={40} className="text-primary/40" />
          </div>
          <div>
            <p className="font-heading font-extrabold text-xl text-white/60 uppercase tracking-widest">Aucun routeur configuré</p>
            <p className="text-sm text-white/30 mt-2">Ajoutez votre MikroTik en cliquant sur "Nouveau Routeur" ci-dessus.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Ajouter mon premier routeur
          </button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] text-white/40 uppercase text-[10px] tracking-widest font-heading">
                  <th className="px-6 py-4">Routeur</th>
                  <th className="px-6 py-4">Adresse IP</th>
                  <th className="px-6 py-4">Port</th>
                  <th className="px-6 py-4">Login</th>
                  <th className="px-6 py-4">Connexion</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routers.map((router) => {
                  const testResult = testResults[router.id];
                  const isActive = activeRouter?.id === router.id;
                  return (
                    <tr 
                      key={router.id} 
                      onClick={() => setActiveRouterId(router.id)}
                      className={`border-b border-white/5 cursor-pointer transition-all ${isActive ? 'bg-primary/5' : 'hover:bg-white/[0.02]'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isActive ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-white/40'}`}>
                            <Wifi size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{router.name}</p>
                            {isActive && <span className="text-[10px] text-primary font-bold uppercase tracking-widest">● Actif</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-white/70">{router.ip}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-white/50">{router.port}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/50">{router.login}</span>
                      </td>
                      <td className="px-6 py-4">
                        {testResult === null ? (
                          <span className="text-[10px] text-white/30 italic">En cours...</span>
                        ) : testResult?.success ? (
                          <div className="flex items-center gap-1.5 text-primary text-xs font-bold">
                            <CheckCircle2 size={14} /> {testResult.latencyMs}ms
                          </div>
                        ) : testResult?.success === false ? (
                          <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
                            <AlertCircle size={14} /> Échec
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/20 italic">Non testé</span>
                        )}
                      </td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleTestConnection(router)}
                            disabled={testingId === router.id}
                            className="p-2 rounded-lg border border-white/10 hover:bg-secondary/10 hover:border-secondary/40 transition-all text-secondary disabled:opacity-40"
                            title="Tester la connexion REST API"
                          >
                            {testingId === router.id 
                              ? <RefreshCw className="animate-spin" size={16} /> 
                              : <Zap size={16} />
                            }
                          </button>
                          <button 
                            onClick={() => removeRouter(router.id)}
                            className="p-2 rounded-lg border border-white/10 hover:bg-red-500/10 hover:border-red-500/40 transition-all text-red-500/40 hover:text-red-400"
                            title="Supprimer ce routeur"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error Display */}
      {Object.entries(testResults).map(([id, result]) => {
        if (!result || result.success !== false) return null;
        const router = routers.find(r => r.id === id);
        return (
          <div key={id} className="glass-card p-4 border-red-500/20 bg-red-500/5 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-400">Connexion échouée — {router?.name}</p>
              <p className="text-xs text-white/40 mt-1">{result.error}</p>
              <p className="text-xs text-white/30 mt-2 italic">Vérifiez que le service API (/ip service api) est activé sur votre routeur et que le port est correct (par défaut 8728).</p>
            </div>
          </div>
        );
      })}

      <RouterModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={addRouter}
      />
    </div>
  );
}

export default RoutersPage;
