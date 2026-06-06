import React, { useState, useEffect } from 'react';
import {
  Zap, Plus, RefreshCw, Search, Layers, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useRouter } from '../contexts/RouterContext';
import {
  getVoucherProfiles,
  createHotspotProfile,
  updateHotspotProfile,
  deleteHotspotProfile
} from '../api/mikrotik.real';
import ProfileCard from '../components/profiles/ProfileCard';
import ProfileModal from '../components/profiles/ProfileModal';

function ProfilesPage() {
  const { activeRouter } = useRouter();
  const [profiles, setProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProfiles = async () => {
    if (!activeRouter) return;
    setIsLoading(true);
    try {
      const data = await getVoucherProfiles(activeRouter);
      setProfiles(data);
    } catch (err) {
      showToast('Erreur de chargement des profils: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProfiles(); }, [activeRouter]);

  const handleCreate = async (profileData) => {
    const result = await createHotspotProfile(activeRouter, profileData);
    if (result.success) {
      showToast(`Profil "${profileData.name}" créé avec succès`);
      fetchProfiles();
    } else {
      throw new Error(result.error || 'Erreur de création');
    }
  };

  const handleUpdate = async (profileData) => {
    if (!editingProfile) return;
    const result = await updateHotspotProfile(activeRouter, editingProfile.id, profileData);
    if (result.success) {
      showToast(`Profil "${editingProfile.name}" mis à jour`);
      fetchProfiles();
    } else {
      throw new Error(result.error || 'Erreur de mise à jour');
    }
  };

  const handleDelete = async (profile) => {
    if (!confirm(`Supprimer le profil "${profile.name}" ?\n\nAttention: cette action échouera si des utilisateurs sont encore associés à ce profil.`)) return;
    setDeletingId(profile.id);
    const result = await deleteHotspotProfile(activeRouter, profile.id);
    if (result.success) {
      showToast(`Profil "${profile.name}" supprimé`);
      setProfiles(prev => prev.filter(p => p.id !== profile.id));
    } else {
      showToast(`Impossible de supprimer: ${result.error}`, 'error');
    }
    setDeletingId(null);
  };

  const handleEdit = (profile) => {
    setEditingProfile(profile);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProfile(null);
  };

  // Filter
  const filteredProfiles = profiles.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) ||
      String(p.price).includes(q) ||
      (p.rateLimit || '').toLowerCase().includes(q);
  });

  // Sort: custom profiles first, then defaults
  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return 1;
    if (!a.isDefault && b.isDefault) return -1;
    return (b.price || 0) - (a.price || 0);
  });

  // Stats
  const customProfiles = profiles.filter(p => !p.isDefault);
  const totalRevenuePotential = customProfiles.reduce((sum, p) => sum + (p.price || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl animate-in slide-in-from-right duration-500 ${
          toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-primary/10 border-primary/30 text-primary'
        }`}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-white">Gestionnaire de Profils</h1>
          <p className="text-white/40 font-body">
            Créez et gérez vos offres Hotspot —
            <span className="text-primary font-bold ml-1">{activeRouter?.name || '---'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchProfiles}
            disabled={isLoading}
            className="h-12 px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/60 hover:text-white transition-all text-sm font-bold uppercase"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2 w-fit h-12"
          >
            <Plus size={18} />
            <span>Nouveau Profil</span>
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Layers size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[9px] uppercase font-black text-white/30 tracking-widest">Total Profils</p>
            <p className="text-xl font-extrabold text-white">{profiles.length}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center border border-secondary/20">
            <Zap size={18} className="text-secondary" />
          </div>
          <div>
            <p className="text-[9px] uppercase font-black text-white/30 tracking-widest">Personnalisés</p>
            <p className="text-xl font-extrabold text-white">{customProfiles.length}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3 col-span-2 md:col-span-2">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
            <Search size={18} className="text-accent" />
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher un profil..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent text-white outline-none text-sm font-bold placeholder:text-white/20"
            />
          </div>
        </div>
      </div>

      {/* Profile Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-primary" size={32} />
          <p className="text-white/40 uppercase text-xs font-bold tracking-widest">Chargement des profils depuis le routeur...</p>
        </div>
      ) : sortedProfiles.length === 0 ? (
        <div className="glass-card p-16 flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Zap size={40} className="text-primary/40" />
          </div>
          <div>
            <p className="font-heading font-extrabold text-xl text-white/60 uppercase tracking-widest">
              {search ? 'Aucun résultat' : 'Aucun profil personnalisé'}
            </p>
            <p className="text-sm text-white/30 mt-2">
              {search ? 'Essayez un autre terme de recherche.' : 'Créez votre premier profil hotspot pour commencer à vendre.'}
            </p>
          </div>
          {!search && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Créer mon premier profil
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedProfiles.map(profile => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={deletingId === profile.id}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <ProfileModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={editingProfile ? handleUpdate : handleCreate}
        initialData={editingProfile}
      />
    </div>
  );
}

export default ProfilesPage;
