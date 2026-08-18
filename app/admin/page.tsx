"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  KeyRound, 
  UserPlus, 
  Users, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  ArrowLeft, 
  Loader2, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  UserCheck 
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

export interface InviteCodeItem {
  id: string;
  code: string;
  createdById: string;
  isUsed: boolean;
  usedByUsername?: string;
  createdAt: string;
}

export interface UserItem {
  id: string;
  username: string;
  isAdmin?: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; isAdmin?: boolean } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"invites" | "create-user" | "users" | "security">("invites");

  // Invite Codes State
  const [invites, setInvites] = useState<InviteCodeItem[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteCodeId, setDeleteCodeId] = useState<string | null>(null);

  // Direct User Creation State
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // Users List State
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Change Admin Password State
  const [currentAdminPass, setCurrentAdminPass] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [confirmAdminPass, setConfirmAdminPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Verify auth session
  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && data.authenticated && data.user) {
          setCurrentUser(data.user);
          if (data.user.isAdmin) {
            fetchInvites();
            fetchUsers();
          }
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    verifyAdmin();
  }, []);

  const fetchInvites = async () => {
    setLoadingInvites(true);
    try {
      const res = await fetch("/api/admin/invite-codes");
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch {
      toast.error("Impossible de récupérer les codes d'invitation.");
    } finally {
      setLoadingInvites(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch {
      toast.error("Impossible de charger la liste des membres.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/invite-codes", { method: "POST" });
      if (res.ok) {
        toast.success("Nouveau code d'invitation généré !");
        await fetchInvites();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erreur lors de la génération du code.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur réseau.");
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmDeleteCode = async () => {
    if (!deleteCodeId) return;
    const inviteId = deleteCodeId;
    setDeleteCodeId(null);

    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      if (res.ok) {
        toast.success("Code d'invitation supprimé.");
        await fetchInvites();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Impossible de supprimer le code.");
      }
    } catch {
      toast.error("Erreur de connexion.");
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Code ${code} copié dans le presse-papier !`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateUserDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création du compte.");
      }

      toast.success(`Compte utilisateur @${newUsername} créé avec succès !`);
      setNewUsername("");
      setNewPassword("");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Impossible de créer le compte.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminPass !== confirmAdminPass) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (newAdminPass.length < 6) {
      toast.error("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    setChangingPass(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentAdminPass,
          newPassword: newAdminPass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossible de modifier le mot de passe.");
      }

      toast.success("Mot de passe administrateur modifié avec succès !");
      setCurrentAdminPass("");
      setNewAdminPass("");
      setConfirmAdminPass("");
    } catch (err: any) {
      toast.error(err.message || "Erreur de mise à jour.");
    } finally {
      setChangingPass(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-100">
        <div className="flex items-center gap-3 font-medium text-sm text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span>Vérification des droits d'administration...</span>
        </div>
      </div>
    );
  }

  if (!currentUser || !currentUser.isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl text-center space-y-5">
          <div className="h-12 w-12 rounded-2xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-center text-rose-400 mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-zinc-100">Accès Administrateur Restreint</h2>
            <p className="text-xs text-zinc-400">
              Vous devez être connecté avec un compte administrateur pour accéder à ce portail.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour à l'accueil</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-3 sm:px-8 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg hover:border-zinc-700 shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Retour Studio</span>
              <span className="sm:hidden">Retour</span>
            </Link>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 truncate">
                <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">Portail Admin</h1>
                <p className="text-[10px] text-zinc-500 hidden sm:block">Gestion des accès & membres</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="font-medium text-zinc-300 truncate max-w-[80px] sm:max-w-none">@{currentUser.username}</span>
              <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded uppercase">Admin</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:py-10 max-w-5xl space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("invites")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "invites"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <KeyRound className="h-4 w-4 text-amber-400" />
            <span>Codes d'Invitation ({invites.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("create-user")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "create-user"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <UserPlus className="h-4 w-4 text-indigo-400" />
            <span>Créer un Utilisateur</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === "users"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <Users className="h-4 w-4 text-emerald-400" />
            <span>Membres ({usersList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === "security"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <KeyRound className="h-4 w-4 text-rose-400" />
            <span>Mon Mot de Passe</span>
          </button>
        </div>

        {/* Tab 1: Codes d'Invitation */}
        {activeTab === "invites" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-200">Génération de codes d'invitation</h3>
                <p className="text-xs text-zinc-400">
                  Chaque code est unique et permet à un nouvel utilisateur de s'inscrire sur la plateforme.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateCode}
                disabled={generating}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all shrink-0"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>Générer un Nouveau Code</span>
              </button>
            </div>

            {loadingInvites ? (
              <div className="p-12 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Chargement des codes d'invitation...</span>
              </div>
            ) : invites.length === 0 ? (
              <div className="p-12 text-center space-y-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20">
                <KeyRound className="h-8 w-8 text-zinc-600 mx-auto" />
                <h4 className="text-sm font-semibold text-zinc-300">Aucun code généré</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Générez un premier code d'invitation pour permettre à vos collaborateurs ou proches de s'inscrire.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
                <div className="divide-y divide-zinc-800/60">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 text-xs hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-zinc-200 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg text-sm tracking-wider">
                          {inv.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(inv.code)}
                          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 border border-zinc-700/60 bg-zinc-800/80 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          {copiedCode === inv.code ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                        {inv.isUsed ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Utilisé par @{inv.usedByUsername || "Inconnu"}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Disponible</span>
                          </div>
                        )}

                        <span className="text-[11px] text-zinc-500 font-mono">
                          {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                        </span>

                        <button
                          type="button"
                          onClick={() => setDeleteCodeId(inv.id)}
                          className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                          title="Supprimer ce code"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Création Directe de Compte */}
        {activeTab === "create-user" && (
          <div className="max-w-xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="space-y-1.5 border-b border-zinc-800 pb-4">
              <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-400" />
                <span>Création Directe d'Utilisateur</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Créez directement un compte utilisateur sans passer par un code d'invitation.
              </p>
            </div>

            <form onSubmit={handleCreateUserDirect} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Nom d'utilisateur</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="ex: alexandre, thomas..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mot de passe sécurisé (min. 6 caractères)"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={creatingUser}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all mt-2"
              >
                {creatingUser ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
                <span>Créer le Compte Immédiatement</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Liste des Membres */}
        {activeTab === "users" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-200">Membres Enregistrés</h3>
                <p className="text-xs text-zinc-400">
                  Vue d'ensemble de tous les comptes enregistrés sur la plateforme.
                </p>
              </div>
              <span className="text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg">
                Total : {usersList.length} membre(s)
              </span>
            </div>

            {loadingUsers ? (
              <div className="p-12 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Chargement des membres...</span>
              </div>
            ) : usersList.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-2xl">
                Aucun utilisateur trouvé.
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
                <div className="divide-y divide-zinc-800/60">
                  {usersList.map((usr) => (
                    <div
                      key={usr.id}
                      className="flex items-center justify-between p-4 text-xs hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-200">
                          {usr.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-100">@{usr.username}</span>
                            {usr.isAdmin && (
                              <span className="rounded-md bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 text-[9px] font-bold text-indigo-400 uppercase">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500">ID: {usr.id.substring(0, 8)}...</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-zinc-400 font-mono">
                          Inscrit le {new Date(usr.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Sécurité & Mot de Passe */}
        {activeTab === "security" && (
          <div className="max-w-xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="space-y-1.5 border-b border-zinc-800 pb-4">
              <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-rose-400" />
                <span>Modifier mon Mot de Passe Administrateur</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Mettez à jour le mot de passe de votre compte @{currentUser.username} en toute sécurité.
              </p>
            </div>

            <form onSubmit={handleChangeAdminPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Mot de passe actuel</label>
                <input
                  type="password"
                  required
                  value={currentAdminPass}
                  onChange={(e) => setCurrentAdminPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Nouveau mot de passe</label>
                <input
                  type="password"
                  required
                  value={newAdminPass}
                  onChange={(e) => setNewAdminPass(e.target.value)}
                  placeholder="Nouveau mot de passe (min. 6 caractères)"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Confirmer le nouveau mot de passe</label>
                <input
                  type="password"
                  required
                  value={confirmAdminPass}
                  onChange={(e) => setConfirmAdminPass(e.target.value)}
                  placeholder="Répétez le nouveau mot de passe"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={changingPass}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all mt-2"
              >
                {changingPass ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                <span>Mettre à Jour mon Mot de Passe</span>
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Confirmation Modal for Delete Code */}
      <ConfirmModal
        isOpen={deleteCodeId !== null}
        title="Supprimer le code d'invitation"
        message="Êtes-vous certain de vouloir supprimer ce code d'invitation ? Si le code n'a pas encore été utilisé, il ne sera plus valide."
        confirmLabel="Supprimer définitivement"
        onConfirm={handleConfirmDeleteCode}
        onCancel={() => setDeleteCodeId(null)}
      />
    </div>
  );
}
