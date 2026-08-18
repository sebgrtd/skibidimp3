"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, Plus, Copy, Check, Trash2, ShieldCheck, UserCheck, Loader2, Sparkles, UserPlus, Users } from "lucide-react";

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
  email: string;
  isAdmin?: boolean;
  createdAt: string;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<"invites" | "create-user" | "users">("invites");

  // Invite Codes State
  const [invites, setInvites] = useState<InviteCodeItem[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Direct User Creation State
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Users List State
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchInvites = async () => {
    try {
      const res = await fetch("/api/admin/invite-codes");
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch {} finally {
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
    } catch {} finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchInvites();
    fetchUsers();
  }, []);

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/invite-codes", { method: "POST" });
      if (res.ok) {
        await fetchInvites();
      }
    } catch {} finally {
      setGenerating(false);
    }
  };

  const handleDeleteCode = async (inviteId: string) => {
    if (!confirm("Supprimer ce code d'invitation ?")) return;
    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      if (res.ok) {
        await fetchInvites();
      }
    } catch {}
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateUserDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setUserMsg(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          password: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création du compte.");
      }

      setUserMsg({ type: "success", text: `Le compte pour @${newUsername} a été créé avec succès !` });
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      fetchUsers();
    } catch (err: any) {
      setUserMsg({ type: "error", text: err.message || "Impossible de créer le compte." });
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-amber-500/40 bg-slate-900/90 p-6 shadow-2xl space-y-6 backdrop-blur-xl">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold shadow-lg shadow-amber-500/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Panneau d'Administration</span>
              <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-400 font-extrabold uppercase">
                ADMIN ACCESS
              </span>
            </h2>
            <p className="text-xs text-slate-400">Gestion des utilisateurs & Codes d'invitation</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("invites")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "invites" ? "bg-amber-500 text-slate-950 font-extrabold shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Codes d'Invitation</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("create-user")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "create-user" ? "bg-amber-500 text-slate-950 font-extrabold shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Créer un Compte Direct</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "users" ? "bg-amber-500 text-slate-950 font-extrabold shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Liste Utilisateurs</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Codes d'invitation */}
      {activeTab === "invites" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Codes d'Invitation Générés ({invites.length})
            </div>
            <button
              type="button"
              onClick={handleGenerateCode}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg hover:brightness-110 disabled:opacity-50 transition-all"
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
            <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              <span>Chargement des codes...</span>
            </div>
          ) : invites.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs space-y-2 border border-dashed border-slate-800 rounded-xl">
              <KeyRound className="h-8 w-8 mx-auto text-slate-600" />
              <p>Aucun code d'invitation généré pour le moment.</p>
              <p className="text-[11px] text-slate-400">Cliquez sur "Générer un Nouveau Code" pour permettre à quelqu'un de s'inscrire.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-72 overflow-y-auto">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3 text-xs hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-amber-400 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-lg text-sm tracking-wider">
                      {inv.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(inv.code)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white border border-slate-700 bg-slate-800 px-2.5 py-1 rounded-md transition-colors"
                    >
                      {copiedCode === inv.code ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    {inv.isUsed ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px]">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Utilisé par @{inv.usedByUsername}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full text-[11px]">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        <span>Disponible (Usage unique)</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteCode(inv.id)}
                      className="text-slate-500 hover:text-red-400 p-1"
                      title="Supprimer ce code"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Création Directe de Compte Utilisateur */}
      {activeTab === "create-user" && (
        <form onSubmit={handleCreateUserDirect} className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-amber-400" />
              <span>Créer un Compte Utilisateur en 1-Clic</span>
            </h3>
            <p className="text-xs text-slate-400">
              En tant qu'administrateur, vous pouvez créer un compte directement sans passer par un code d'invitation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nom d'utilisateur</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Ex: Sebastien"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Adresse Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Ex: user@exemple.fr"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mot de passe</label>
              <input
                type="text"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ex: Pass1234!"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {userMsg && (
            <div className={`p-3 rounded-xl text-xs border ${
              userMsg.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}>
              {userMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={creatingUser}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {creatingUser ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            <span>Créer le Compte Directement</span>
          </button>
        </form>
      )}

      {/* Tab 3: Liste des Utilisateurs */}
      {activeTab === "users" && (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            Comptes Inscrits sur la Plateforme ({usersList.length})
          </div>

          {loadingUsers ? (
            <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              <span>Chargement des utilisateurs...</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-72 overflow-y-auto">
              {usersList.map((usr) => (
                <div key={usr.id} className="flex items-center justify-between px-4 py-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-xs">
                      {usr.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-white flex items-center gap-2">
                        <span>@{usr.username}</span>
                        {usr.isAdmin && (
                          <span className="rounded-md bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[9px] text-amber-400 font-bold">
                            ADMIN
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-400">{usr.email}</span>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono">
                    Créé le {new Date(usr.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
