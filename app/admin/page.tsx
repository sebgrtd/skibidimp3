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
  UserCheck,
  Cookie,
  FileText,
  UploadCloud,
  AlertTriangle,
  Activity,
  Play,
  Search,
  Key,
  Shield,
  Lock,
  UserX,
  X
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
  downloadCount?: number;
}

export default function AdminPage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; isAdmin?: boolean } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"invites" | "create-user" | "users" | "security" | "cookies" | "diagnostics">("invites");

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

  // Users Management State
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [userToResetPass, setUserToResetPass] = useState<UserItem | null>(null);
  const [resetPassInput, setResetPassInput] = useState("");
  const [isResettingPass, setIsResettingPass] = useState(false);
  const [togglingAdminId, setTogglingAdminId] = useState<string | null>(null);

  // Change Admin Password State
  const [currentAdminPass, setCurrentAdminPass] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [confirmAdminPass, setConfirmAdminPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Cookies YouTube Anti-Bot State
  const [cookiesInfo, setCookiesInfo] = useState<{ hasCookies: boolean; size: number; lastModified: string | null } | null>(null);
  const [loadingCookies, setLoadingCookies] = useState(false);
  const [cookiesInput, setCookiesInput] = useState("");
  const [savingCookies, setSavingCookies] = useState(false);
  const [showDeleteCookiesModal, setShowDeleteCookiesModal] = useState(false);

  // Platform Diagnostics State
  const [diagTests, setDiagTests] = useState<any[]>([]);
  const [runningDiag, setRunningDiag] = useState(false);

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
            fetchCookiesStatus();
            fetchDiagnosticsList();
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

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userToDelete.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Utilisateur @${userToDelete.username} supprimé avec succès.`);
        setUserToDelete(null);
        await fetchUsers();
      } else {
        toast.error(data.error || "Impossible de supprimer cet utilisateur.");
      }
    } catch {
      toast.error("Erreur réseau lors de la suppression.");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleToggleAdminRole = async (usr: UserItem) => {
    setTogglingAdminId(usr.id);
    try {
      const newRole = !usr.isAdmin;
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: usr.id,
          action: "toggle_admin",
          isAdmin: newRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(newRole ? `@${usr.username} est désormais administrateur.` : `Droits administrateur retirés à @${usr.username}.`);
        await fetchUsers();
      } else {
        toast.error(data.error || "Impossible de modifier le rôle.");
      }
    } catch {
      toast.error("Erreur de connexion.");
    } finally {
      setTogglingAdminId(null);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToResetPass || !resetPassInput.trim()) return;
    if (resetPassInput.trim().length < 4) {
      toast.error("Le mot de passe doit comporter au moins 4 caractères.");
      return;
    }
    setIsResettingPass(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userToResetPass.id,
          action: "reset_password",
          newPassword: resetPassInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Mot de passe de @${userToResetPass.username} réinitialisé avec succès !`);
        setUserToResetPass(null);
        setResetPassInput("");
      } else {
        toast.error(data.error || "Erreur lors de la réinitialisation.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setIsResettingPass(false);
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

  const fetchCookiesStatus = async () => {
    setLoadingCookies(true);
    try {
      const res = await fetch("/api/admin/cookies");
      if (res.ok) {
        const data = await res.json();
        setCookiesInfo(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingCookies(false);
    }
  };

  const handleSaveCookies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookiesInput.trim()) {
      toast.error("Veuillez coller le contenu de vos cookies.");
      return;
    }

    setSavingCookies(true);
    try {
      const res = await fetch("/api/admin/cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookiesContent: cookiesInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer les cookies.");

      toast.success("Cookies YouTube enregistrés avec succès !");
      setCookiesInput("");
      fetchCookiesStatus();
    } catch (err: any) {
      toast.error(err.message || "Erreur de sauvegarde.");
    } finally {
      setSavingCookies(false);
    }
  };

  const fetchDiagnosticsList = async () => {
    try {
      const res = await fetch("/api/admin/diagnostics");
      if (res.ok) {
        const data = await res.json();
        setDiagTests(data.tests || []);
      }
    } catch {}
  };

  const handleRunAllDiagnostics = async () => {
    if (diagTests.length === 0) return;
    setRunningDiag(true);

    const updated = [...diagTests].map((t) => ({ ...t, status: "pending", message: undefined, error: undefined }));
    setDiagTests(updated);

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      item.status = "running";
      setDiagTests([...updated]);

      try {
        const res = await fetch("/api/admin/diagnostics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: item.url, format: item.format }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          item.status = "success";
          item.durationMs = data.durationMs;
          item.fileSizeBytes = data.fileSizeBytes;
          item.message = `${Math.round((data.fileSizeBytes || 0) / 1024)} Ko en ${((data.durationMs || 0) / 1000).toFixed(1)}s`;
        } else {
          item.status = "error";
          item.durationMs = data.durationMs;
          item.error = data.error || "Erreur de téléchargement";
        }
      } catch (err: any) {
        item.status = "error";
        item.error = err.message || "Erreur réseau";
      }

      setDiagTests([...updated]);
    }

    setRunningDiag(false);
    toast.success("Diagnostic complet terminé !");
  };

  const handleConfirmDeleteCookies = async () => {
    try {
      const res = await fetch("/api/admin/cookies", { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression.");
      toast.info("Cookies YouTube supprimés.");
      setShowDeleteCookiesModal(false);
      fetchCookiesStatus();
    } catch (err: any) {
      toast.error(err.message || "Impossible de supprimer les cookies.");
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

          <button
            type="button"
            onClick={() => setActiveTab("cookies")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === "cookies"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <Cookie className="h-4 w-4 text-amber-400" />
            <span>Cookies Anti-Bot</span>
            {cookiesInfo?.hasCookies && (
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("diagnostics")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === "diagnostics"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <Activity className="h-4 w-4 text-cyan-400" />
            <span>Diagnostics & Tests</span>
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

        {/* Tab 3: Liste & Gestion des Membres */}
        {activeTab === "users" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-200">Gestion des Utilisateurs</h3>
                <p className="text-xs text-zinc-400">
                  Gérez les permissions, réinitialisez les mots de passe et supprimez des comptes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
                  Total : {usersList.length} membre(s)
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("create-user")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Nouveau</span>
                </button>
              </div>
            </div>

            {/* Search filter for users */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Rechercher un membre par nom d'utilisateur..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
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
                  {usersList
                    .filter((u) => !userSearchQuery || u.username.toLowerCase().includes(userSearchQuery.toLowerCase()))
                    .map((usr) => {
                      const isSelf = usr.id === currentUser?.id;
                      return (
                        <div
                          key={usr.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 text-xs hover:bg-zinc-800/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm border ${
                              usr.isAdmin 
                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" 
                                : "bg-zinc-800 border-zinc-700 text-zinc-200"
                            }`}>
                              {usr.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-zinc-100 text-sm">@{usr.username}</span>
                                {isSelf && (
                                  <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                                    Vous
                                  </span>
                                )}
                                {usr.isAdmin ? (
                                  <span className="rounded-md bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-400 uppercase tracking-wide">
                                    Admin
                                  </span>
                                ) : (
                                  <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                                    Membre
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                                <span>{usr.downloadCount || 0} téléchargement(s)</span>
                                <span>•</span>
                                <span>Inscrit le {new Date(usr.createdAt).toLocaleDateString("fr-FR")}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {/* Toggle Admin */}
                            <button
                              type="button"
                              onClick={() => handleToggleAdminRole(usr)}
                              disabled={togglingAdminId === usr.id || (isSelf && usr.isAdmin)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                                usr.isAdmin
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                  : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                              } disabled:opacity-40`}
                              title={usr.isAdmin ? "Rétrograder en membre standard" : "Promouvoir en Administrateur"}
                            >
                              {togglingAdminId === usr.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Shield className="h-3.5 w-3.5" />
                              )}
                              <span>{usr.isAdmin ? "Rétrograder" : "Promouvoir Admin"}</span>
                            </button>

                            {/* Reset Password */}
                            <button
                              type="button"
                              onClick={() => {
                                setUserToResetPass(usr);
                                setResetPassInput("");
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors text-xs font-medium"
                              title="Réinitialiser le mot de passe"
                            >
                              <Key className="h-3.5 w-3.5 text-zinc-400" />
                              <span>Mot de passe</span>
                            </button>

                            {/* Delete User */}
                            <button
                              type="button"
                              onClick={() => setUserToDelete(usr)}
                              disabled={isSelf}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isSelf ? "Vous ne pouvez pas supprimer votre propre compte" : "Supprimer définitivement l'utilisateur"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Supprimer</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
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

        {/* Tab 5: Cookies YouTube Anti-Bot */}
        {activeTab === "cookies" && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Status Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    <Cookie className="h-5 w-5 text-amber-400" />
                    <span>Cookies YouTube & Contournement Anti-Bot</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Permet au serveur d'hébergement de télécharger des vidéos et musiques YouTube sans être bloqué par la protection anti-robot.
                  </p>
                </div>

                <div className="shrink-0">
                  {loadingCookies ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                      <span>Vérification...</span>
                    </div>
                  ) : cookiesInfo?.hasCookies ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Cookies Actifs ({Math.round((cookiesInfo.size || 0) / 1024)} Ko)</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Aucun Cookie Configuré</span>
                    </div>
                  )}
                </div>
              </div>

              {cookiesInfo?.hasCookies && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <FileText className="h-4 w-4 text-indigo-400" />
                    <span>Fichier <code className="font-mono text-zinc-100">cookies.txt</code> actif</span>
                    {cookiesInfo.lastModified && (
                      <span className="text-[11px] text-zinc-500">
                        (mis à jour le {new Date(cookiesInfo.lastModified).toLocaleDateString("fr-FR")})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteCookiesModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Supprimer</span>
                  </button>
                </div>
              )}

              {/* Form to import / paste cookies */}
              <form onSubmit={handleSaveCookies} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>{cookiesInfo?.hasCookies ? "Remplacer les cookies (Format Netscape / cookies.txt)" : "Coller le contenu de votre fichier cookies.txt"}</span>
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={cookiesInput}
                    onChange={(e) => setCookiesInput(e.target.value)}
                    placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1789000000&#9;SID&#9;..."
                    className="w-full font-mono text-[11px] rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 placeholder:text-zinc-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-y"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3.5 py-2.5 text-xs font-semibold text-zinc-200 transition-all">
                    <UploadCloud className="h-4 w-4 text-indigo-400" />
                    <span>Importer un fichier .txt</span>
                    <input
                      type="file"
                      accept=".txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const text = event.target?.result as string;
                            if (text) setCookiesInput(text);
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={savingCookies || !cookiesInput.trim()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
                  >
                    {savingCookies ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>Enregistrer les Cookies</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Guide Card */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-5 space-y-3 text-xs text-zinc-400">
              <h4 className="font-semibold text-zinc-200 flex items-center gap-2">
                <span>💡 Comment exporter vos cookies YouTube en 30 secondes ?</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 text-[11px] leading-relaxed">
                <li>Installez l'extension gratuite Chrome/Firefox <strong className="text-zinc-200">« Get cookies.txt LOCALLY »</strong>.</li>
                <li>Rendez-vous sur <strong className="text-zinc-200">youtube.com</strong> en étant connecté à votre compte.</li>
                <li>Cliquez sur l'icône de l'extension et appuyez sur <strong className="text-zinc-200">« Export »</strong>.</li>
                <li>Ouvrez le fichier texte téléchargé, copiez tout son contenu et collez-le dans le formulaire ci-dessus.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 6: Diagnostics & Tests Plateformes */}
        {activeTab === "diagnostics" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-xl">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-400" />
                  <span>Banc de Test & Diagnostic des Téléchargements</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Exécute une série de tests réels de bout en bout sur l'ensemble des plateformes et formats supportés.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunAllDiagnostics}
                disabled={runningDiag || diagTests.length === 0}
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 disabled:opacity-50 transition-all shrink-0"
              >
                {runningDiag ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-white" />
                )}
                <span>{runningDiag ? "Test en cours..." : "Lancer tous les Tests"}</span>
              </button>
            </div>

            {/* Test Matrix Table */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
              <div className="divide-y divide-zinc-800/60">
                {diagTests.map((test, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 text-xs hover:bg-zinc-800/20 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200">{test.name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] uppercase font-mono font-bold text-zinc-300">
                          {test.format}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono truncate max-w-lg">
                        {test.url}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {test.status === "running" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-semibold">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Test en cours...</span>
                        </span>
                      )}

                      {test.status === "success" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{test.message || "Succès"}</span>
                        </span>
                      )}

                      {test.status === "error" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-semibold max-w-xs truncate" title={test.error}>
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{test.error || "Échec"}</span>
                        </span>
                      )}

                      {(!test.status || test.status === "pending") && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-400 text-[11px]">
                          <Clock className="h-3.5 w-3.5" />
                          <span>En attente</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

      {/* Confirmation Modal for Delete User */}
      <ConfirmModal
        isOpen={userToDelete !== null}
        title={`Supprimer le compte @${userToDelete?.username}`}
        message={`Êtes-vous certain de vouloir supprimer définitivement l'utilisateur @${userToDelete?.username} ? Toutes ses sessions actives et l'intégralité de son historique de téléchargement seront définitivement effacés.`}
        confirmLabel={isDeletingUser ? "Suppression..." : "Supprimer l'utilisateur"}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      {/* Reset Password Modal */}
      {userToResetPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Réinitialiser le mot de passe
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserToResetPass(null);
                  setResetPassInput("");
                }}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Définir un nouveau mot de passe pour le compte <strong className="text-zinc-200">@{userToResetPass.username}</strong>.
            </p>

            <form onSubmit={handleConfirmResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Nouveau mot de passe</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={resetPassInput}
                  onChange={(e) => setResetPassInput(e.target.value)}
                  placeholder="Minimum 4 caractères"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserToResetPass(null);
                    setResetPassInput("");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass || !resetPassInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
                >
                  {isResettingPass ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>Mettre à jour</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Cookies */}
      <ConfirmModal
        isOpen={showDeleteCookiesModal}
        title="Supprimer les cookies YouTube"
        message="Êtes-vous certain de vouloir supprimer les cookies enregistrés ? Les téléchargements YouTube risquent d'être à nouveau bloqués par les contrôles anti-bot."
        confirmLabel="Supprimer les cookies"
        onConfirm={handleConfirmDeleteCookies}
        onCancel={() => setShowDeleteCookiesModal(false)}
      />
    </div>
  );
}
